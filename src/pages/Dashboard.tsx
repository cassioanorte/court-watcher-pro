import { motion } from "framer-motion";
import { Newspaper, ArrowRight, Activity, Clock, Eye, ExternalLink, RefreshCw, Send } from "lucide-react";
import { getCourtUrl, extractProcessNumbers, isEprocProcess } from "@/lib/courtUrls";
import { Link } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardCalendar from "@/components/DashboardCalendar";
import DashboardStatsCards from "@/components/dashboard/DashboardStatsCards";
import DashboardReminders from "@/components/dashboard/DashboardReminders";
import DashboardCrmPipeline from "@/components/dashboard/DashboardCrmPipeline";
import DashboardDeadlines from "@/components/dashboard/DashboardDeadlines";
import DashboardTaskNotifications from "@/components/dashboard/DashboardTaskNotifications";
import DashboardFulfillments from "@/components/dashboard/DashboardFulfillments";
import FulfillmentModal from "@/components/FulfillmentModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Publication {
  id: string;
  title: string;
  source: string;
  publication_type: string | null;
  process_number: string | null;
  read: boolean;
  publication_date: string;
  content: string | null;
  organ: string | null;
  external_url: string | null;
  case_id: string | null;
}

interface TodayMovement {
  id: string;
  title: string;
  details: string | null;
  occurred_at: string;
  case_id: string;
  process_number: string;
}

const Dashboard = () => {
  const { tenantId } = useAuth();
  const [agentsCount, setAgentsCount] = useState(0);
  const [fulfillmentsCount, setFulfillmentsCount] = useState(0);
  const [appointmentsCount, setAppointmentsCount] = useState(0);
  const [todayPubs, setTodayPubs] = useState<Publication[]>([]);
  const [todayMovements, setTodayMovements] = useState<TodayMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPub, setSelectedPub] = useState<Publication | null>(null);
  const [lastMovRefresh, setLastMovRefresh] = useState<Date>(new Date());
  const [refreshingMovs, setRefreshingMovs] = useState(false);
  const [refreshingPubs, setRefreshingPubs] = useState(false);
  const [fulfillmentModal, setFulfillmentModal] = useState<{ open: boolean; caseId?: string; processNumber?: string; sourceType?: "publication" | "movement"; sourceId?: string }>({ open: false });

  const fetchTodayMovements = useCallback(async () => {
    if (!tenantId) return;
    const today = new Date().toISOString().split("T")[0];
    const startOfDay = `${today}T00:00:00.000Z`;
    const endOfDay = `${today}T23:59:59.999Z`;

    const { data: cases } = await supabase
      .from("cases")
      .select("id, process_number")
      .eq("tenant_id", tenantId);

    if (!cases || cases.length === 0) {
      setTodayMovements([]);
      return;
    }

    const caseIds = cases.map((c) => c.id);
    const caseMap: Record<string, string> = {};
    cases.forEach((c) => { caseMap[c.id] = c.process_number; });

    const { data: movs } = await supabase
      .from("movements")
      .select("id, title, details, occurred_at, created_at, case_id")
      .in("case_id", caseIds)
      .gte("created_at", startOfDay)
      .lte("created_at", endOfDay)
      .order("created_at", { ascending: false })
      .limit(50);

    setTodayMovements(
      (movs || []).map((m) => ({
        ...m,
        process_number: caseMap[m.case_id] || "—",
      }))
    );
    setLastMovRefresh(new Date());
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      const today = new Date().toISOString().split("T")[0];
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() + 7);
      const weekEndStr = weekEnd.toISOString();

      const [agentsRes, fulfillmentsRes, appointmentsRes, pubsRes] = await Promise.all([
        supabase.from("ai_agents").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
        supabase.from("case_fulfillments").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "pendente"),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("start_at", new Date().toISOString()).lte("start_at", weekEndStr),
        supabase.from("dje_publications").select("id, title, source, publication_type, process_number, read, publication_date, content, organ, external_url, case_id").eq("tenant_id", tenantId).eq("publication_date", today).order("created_at", { ascending: false }).limit(10),
      ]);

      setAgentsCount(agentsRes.count || 0);
      setFulfillmentsCount(fulfillmentsRes.count || 0);
      setAppointmentsCount(appointmentsRes.count || 0);
      setTodayPubs((pubsRes.data || []) as Publication[]);

      setLoading(false);
    };
    load();
    fetchTodayMovements();
  }, [tenantId, fetchTodayMovements]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchTodayMovements();
    }, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchTodayMovements]);

  const [pubLookback, setPubLookback] = useState(1);

  const refreshPubs = useCallback(async (lookbackOverride?: number) => {
    if (!tenantId) return;
    setRefreshingPubs(true);
    try {
      const days = lookbackOverride ?? pubLookback;
      await supabase.functions.invoke("poll-email-imap", {
        body: { tenant_id: tenantId, lookback_days: days },
      });
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("dje_publications")
        .select("id, title, source, publication_type, process_number, read, publication_date, content, organ, external_url, case_id")
        .eq("tenant_id", tenantId)
        .eq("publication_date", today)
        .order("created_at", { ascending: false })
        .limit(10);
      setTodayPubs((data || []) as Publication[]);
      toast.success("Publicações atualizadas");
    } catch (err) {
      toast.error("Erro ao atualizar publicações");
    } finally {
      setRefreshingPubs(false);
    }
  }, [tenantId, pubLookback]);

  const handlePubClick = async (pub: Publication) => {
    setSelectedPub(pub);
    if (!pub.read) {
      await supabase.from("dje_publications").update({ read: true }).eq("id", pub.id);
      setTodayPubs((prev) => prev.map((p) => (p.id === pub.id ? { ...p, read: true } : p)));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral do escritório</p>
      </div>

      {/* Stat Cards with gradients */}
      <DashboardStatsCards
        agentsCount={agentsCount}
        fulfillmentsCount={fulfillmentsCount}
        appointmentsCount={appointmentsCount}
        loading={loading}
      />

      {/* Task Notifications */}
      <DashboardTaskNotifications />

      {/* Fulfillments + Reminders + Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DashboardFulfillments />
        <DashboardReminders />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DashboardCrmPipeline />
        <DashboardDeadlines />
      </div>

      {/* Movements row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Today's Movements */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <div className="bg-card rounded-xl border shadow-card p-5 h-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-accent" />
                <h2 className="font-semibold text-foreground">Movimentações de Hoje</h2>
                {todayMovements.length > 0 && (
                  <Badge variant="default" className="text-xs">{todayMovements.length}</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {lastMovRefresh.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <Button variant="ghost" size="sm" onClick={async () => { setRefreshingMovs(true); await fetchTodayMovements(); setRefreshingMovs(false); toast.success("Movimentações atualizadas"); }} disabled={refreshingMovs} className="text-muted-foreground text-xs h-7 px-2 gap-1">
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshingMovs ? "animate-spin" : ""}`} />
                  {refreshingMovs ? "Atualizando..." : "Atualizar"}
                </Button>
              </div>
            </div>
            {todayMovements.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma movimentação hoje</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {todayMovements.map((mov) => (
                  <div key={mov.id} className="rounded-md border p-3 hover:border-accent/30 transition-all">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <Link to={`/processos/${mov.case_id}`}>
                        <Badge variant="outline" className="text-[10px] font-mono hover:text-accent">{mov.process_number}</Badge>
                      </Link>
                      <div className="flex items-center gap-1">
                        {(() => {
                          const url = getCourtUrl(mov.process_number);
                          const eproc = isEprocProcess(mov.process_number);
                          if (!url) return null;
                          return eproc ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-accent"
                              onClick={() => {
                                navigator.clipboard.writeText(mov.process_number.replace(/\D/g, ""));
                                toast.success("Nº copiado! Cole na busca do eproc. Abrindo portal...");
                                window.open(url, "_blank");
                              }}
                              title="Abrir no eproc (copia nº)"
                            >
                              <ExternalLink className="w-3 h-3" /> Tribunal
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-accent"
                              onClick={() => window.open(url, "_blank")}
                              title="Ver no tribunal"
                            >
                              <ExternalLink className="w-3 h-3" /> Tribunal
                            </Button>
                          );
                        })()}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-accent"
                          onClick={() => setFulfillmentModal({ open: true, caseId: mov.case_id, processNumber: mov.process_number, sourceType: "movement", sourceId: mov.id })}
                        >
                          <Send className="w-3 h-3" /> Encaminhar
                        </Button>
                      </div>
                    </div>
                    <Link to={`/processos/${mov.case_id}`}>
                      <p className="text-sm text-foreground font-medium line-clamp-1">{mov.title}</p>
                      {mov.details && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{mov.details}</p>}
                    </Link>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(mov.occurred_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Today's Publications */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="bg-card rounded-xl border shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Newspaper className="w-5 h-5 text-accent" />
              <h2 className="font-semibold text-foreground">Publicações de Hoje</h2>
              {todayPubs.length > 0 && (
                <Badge variant="secondary" className="text-xs">{todayPubs.length}</Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Select value={String(pubLookback)} onValueChange={(v) => setPubLookback(Number(v))}>
                <SelectTrigger className="h-7 w-[90px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Hoje</SelectItem>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="15">15 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" onClick={() => refreshPubs()} disabled={refreshingPubs} className="text-muted-foreground text-xs h-7 px-2 gap-1">
                <RefreshCw className={`w-3.5 h-3.5 ${refreshingPubs ? "animate-spin" : ""}`} />
                {refreshingPubs ? "Verificando..." : "Atualizar"}
              </Button>
              <Button variant="ghost" size="sm" asChild className="gap-1 text-muted-foreground">
                <Link to="/publicacoes">Ver todas <ArrowRight className="w-4 h-4" /></Link>
              </Button>
            </div>
          </div>
          {todayPubs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma publicação hoje</p>
          ) : (
            <div className="space-y-2">
              {todayPubs.map(pub => (
                <div
                  key={pub.id}
                  className={`rounded-md border p-3 hover:border-accent/30 transition-all ${!pub.read ? "border-l-4 border-l-accent" : ""}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <button onClick={() => handlePubClick(pub)} className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{pub.source}</Badge>
                      {pub.publication_type && <span className="text-[10px] text-muted-foreground">{pub.publication_type}</span>}
                      {!pub.read && <span className="w-2 h-2 rounded-full bg-accent" />}
                    </button>
                  </div>
                  <button onClick={() => handlePubClick(pub)} className="text-left w-full">
                    <p className={`text-sm line-clamp-1 ${pub.read ? "text-muted-foreground" : "text-foreground font-medium"}`}>{pub.title}</p>
                    {pub.process_number && <p className="text-xs text-muted-foreground font-mono mt-1">{pub.process_number}</p>}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      <DashboardCalendar />

      {/* Publication Detail Dialog */}
      <Dialog open={!!selectedPub} onOpenChange={() => setSelectedPub(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base leading-snug">{selectedPub?.title}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs">{selectedPub?.source}</Badge>
            {selectedPub?.publication_type && <Badge variant="secondary" className="text-xs">{selectedPub.publication_type}</Badge>}
            {selectedPub?.organ && <span className="text-xs text-muted-foreground">{selectedPub.organ}</span>}
          </div>
          {(() => {
            const allText = (selectedPub?.title || "") + " " + (selectedPub?.content || "");
            const numbers = extractProcessNumbers(allText);
            if (selectedPub?.process_number && !numbers.includes(selectedPub.process_number)) {
              numbers.unshift(selectedPub.process_number);
            }
            if (numbers.length === 0) return null;
            return (
              <div className="space-y-1.5 mt-2">
                <p className="text-xs font-medium text-muted-foreground">Processos identificados:</p>
                {numbers.map((pn) => {
                  const url = getCourtUrl(pn, selectedPub?.source);
                  const eproc = isEprocProcess(pn);
                  return (
                    <div key={pn} className="flex items-center gap-2">
                      <span className="text-xs font-mono text-foreground">{pn}</span>
                      {url && (
                        eproc ? (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(pn.replace(/\D/g, ""));
                              toast.success("Nº copiado! Cole na busca do eproc. Abrindo portal...");
                              window.open(url, "_blank");
                            }}
                            className="text-accent hover:text-accent/80 transition-colors inline-flex items-center gap-1 text-xs"
                            title="Abrir no eproc (copia nº)"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <a href={url} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent/80 transition-colors" title="Ver no tribunal">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-accent"
                        onClick={() => { setSelectedPub(null); setFulfillmentModal({ open: true, caseId: undefined, processNumber: pn, sourceType: "publication", sourceId: selectedPub?.id }); }}
                      >
                        <Send className="w-3 h-3" /> Encaminhar
                      </Button>
                    </div>
                  );
                })}
              </div>
            );
          })()}
          <Separator className="my-2" />
          <ScrollArea className="max-h-72">
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{selectedPub?.content || "Conteúdo não disponível."}</p>
          </ScrollArea>
          {selectedPub?.external_url && (
            <div className="mt-3">
              <Button variant="outline" size="sm" asChild className="gap-1">
                <a href={selectedPub.external_url} target="_blank" rel="noopener noreferrer">
                  <Eye className="w-4 h-4" /> Ver original
                </a>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <FulfillmentModal
        open={fulfillmentModal.open}
        onOpenChange={(open) => setFulfillmentModal(prev => ({ ...prev, open }))}
        caseId={fulfillmentModal.caseId}
        processNumber={fulfillmentModal.processNumber}
        sourceType={fulfillmentModal.sourceType}
        sourceId={fulfillmentModal.sourceId}
      />
    </div>
  );
};

export default Dashboard;
