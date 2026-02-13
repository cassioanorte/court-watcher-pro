import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, RefreshCw, MessageSquare, FileText, Plus, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const ProcessDetail = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const { tenantId } = useAuth();
  const [caseData, setCaseData] = useState<any>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const [caseRes, movRes] = await Promise.all([
        supabase.from("cases").select("*").eq("id", id).single(),
        supabase.from("movements").select("*").eq("case_id", id).order("occurred_at", { ascending: false }),
      ]);
      if (caseRes.data) setCaseData(caseRes.data);
      if (movRes.data) setMovements(movRes.data);
      setLoading(false);
    };
    load();
  }, [id]);

  const handleRefresh = async () => {
    if (!id) return;
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-movements", {
        body: { case_id: id },
      });
      if (error) throw error;

      toast({
        title: "Consulta realizada!",
        description: `${data.new_movements || 0} nova(s) movimentação(ões) encontrada(s).`,
      });

      // Reload movements
      const { data: movData } = await supabase
        .from("movements")
        .select("*")
        .eq("case_id", id)
        .order("occurred_at", { ascending: false });
      if (movData) setMovements(movData);

      // Reload case for last_checked_at
      const { data: cData } = await supabase.from("cases").select("*").eq("id", id).single();
      if (cData) setCaseData(cData);
    } catch (err: any) {
      toast({ title: "Erro na consulta", description: err.message, variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Carregando...</div>;
  }

  if (!caseData) {
    return <div className="text-sm text-destructive">Processo não encontrado.</div>;
  }

  const sourceLabel: Record<string, string> = {
    TJRS_1G: "TJRS - 1º Grau",
    TJRS_2G: "TJRS - 2º Grau",
    TRF4_JFRS: "TRF4 - JFRS",
    TRF4_JFSC: "TRF4 - JFSC",
    TRF4_JFPR: "TRF4 - JFPR",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back + header */}
      <div>
        <Link to="/processos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">{caseData.process_number}</h1>
            <p className="text-sm text-muted-foreground mt-1">{caseData.subject || "Sem assunto"}</p>
          </div>
          <div className="flex items-center gap-2">
            {caseData.automation_enabled && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success/15 px-2.5 py-1 rounded-full">
                <RefreshCw className="w-3 h-3" /> Automação ativa
              </span>
            )}
            <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
              {sourceLabel[caseData.source] || caseData.source}
            </span>
          </div>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-lg p-4 border shadow-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Status</p>
          <p className="text-sm font-semibold text-foreground">{caseData.simple_status || "—"}</p>
        </div>
        <div className="bg-card rounded-lg p-4 border shadow-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Próximo Passo</p>
          <p className="text-sm font-semibold text-foreground">{caseData.next_step || "—"}</p>
        </div>
        <div className="bg-card rounded-lg p-4 border shadow-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Última consulta</p>
          <p className="text-sm font-semibold text-foreground">
            {caseData.last_checked_at
              ? new Date(caseData.last_checked_at).toLocaleString("pt-BR")
              : "Nunca consultado"}
          </p>
        </div>
      </div>

      {/* Atualizar button */}
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg gradient-accent text-accent-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        {refreshing ? "Consultando tribunais..." : "Atualizar movimentações"}
      </button>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {[
          { label: "Timeline", icon: RefreshCw, active: true },
          { label: "Documentos", icon: FileText, active: false },
          { label: "Mensagens", icon: MessageSquare, active: false },
        ].map((tab) => (
          <button
            key={tab.label}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
              tab.active
                ? "border-accent text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="space-y-0">
        {movements.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhuma movimentação registrada. Clique em "Atualizar movimentações" para consultar os tribunais.
          </p>
        )}
        {movements.map((mov, i) => (
          <motion.div
            key={mov.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="relative pl-8 pb-6 last:pb-0"
          >
            {i < movements.length - 1 && (
              <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />
            )}
            <div className={cn(
              "absolute left-0 top-1 w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center",
              i < 2 ? "border-accent bg-accent/15" : "border-border bg-card"
            )}>
              <div className={cn("w-2 h-2 rounded-full", i < 2 ? "bg-accent" : "bg-muted-foreground/40")} />
            </div>

            <div className="bg-card rounded-lg border p-4 shadow-card">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold text-foreground">{mov.title}</h3>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {new Date(mov.occurred_at).toLocaleString("pt-BR")}
                </span>
              </div>
              {mov.details && <p className="text-xs text-muted-foreground">{mov.details}</p>}
              {mov.source_label && (
                <p className="text-[10px] text-muted-foreground mt-1">Fonte: {mov.source_label}</p>
              )}
              {mov.translation && (
                <div className="mt-3 p-3 bg-accent/5 rounded-md border border-accent/15">
                  <div className="flex items-center gap-1 mb-1">
                    <Info className="w-3 h-3 text-accent" />
                    <span className="text-[10px] font-semibold text-accent uppercase tracking-wide">Entenda a movimentação</span>
                  </div>
                  <p className="text-xs text-foreground/80">{mov.translation}</p>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Manual add */}
      <button className="w-full border-2 border-dashed rounded-lg p-4 text-sm text-muted-foreground hover:text-foreground hover:border-accent/40 transition-colors flex items-center justify-center gap-2">
        <Plus className="w-4 h-4" /> Adicionar movimentação manual
      </button>
    </div>
  );
};

export default ProcessDetail;
