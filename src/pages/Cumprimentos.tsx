import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { ClipboardCheck, Plus, Filter, CheckCircle2, Clock, AlertTriangle, Loader2, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import FulfillmentModal from "@/components/FulfillmentModal";

const CATEGORY_LABELS: Record<string, string> = {
  peticao: "Petição",
  recurso: "Recurso",
  cumprimento_despacho: "Cumprimento de Despacho",
  audiencia_diligencia: "Audiência/Diligência",
  contato_cliente: "Ligar para o Cliente",
  solicitar_documentacao: "Solicitar Documentação",
  manifestacao: "Manifestação",
  alvara: "Alvará",
  calculo: "Cálculo",
  providencia_administrativa: "Providência Administrativa",
  contestacao: "Contestação",
  replica: "Réplica",
  outro: "Outro",
};

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em Andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const PRIORITY_LABELS: Record<string, string> = {
  urgente: "🔴 Urgente",
  normal: "🟡 Normal",
  baixa: "🟢 Baixa",
};

interface Fulfillment {
  id: string;
  case_id: string;
  category: string;
  description: string | null;
  assigned_to: string;
  assigned_by: string;
  due_date: string;
  status: string;
  priority: string;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
  source_type: string | null;
}

interface CaseInfo {
  id: string;
  process_number: string;
  parties: string | null;
}

interface ProfileInfo {
  user_id: string;
  full_name: string;
}

const Cumprimentos = () => {
  const { tenantId, user } = useAuth();
  const { toast } = useToast();
  const [fulfillments, setFulfillments] = useState<Fulfillment[]>([]);
  const [cases, setCases] = useState<Record<string, CaseInfo>>({});
  const [profiles, setProfiles] = useState<Record<string, ProfileInfo>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pendente");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [assignedFilter, setAssignedFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);

  const fetchData = async () => {
    if (!tenantId) return;
    setLoading(true);

    let query = supabase
      .from("case_fulfillments")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("due_date", { ascending: true });

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }
    if (categoryFilter !== "all") {
      query = query.eq("category", categoryFilter);
    }
    if (assignedFilter === "mine") {
      query = query.eq("assigned_to", user!.id);
    } else if (assignedFilter === "delegated") {
      query = query.eq("assigned_by", user!.id).neq("assigned_to", user!.id);
    }

    const { data, error } = await query.limit(200);
    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const items = (data || []) as Fulfillment[];
    setFulfillments(items);

    // Fetch case info
    const caseIds = [...new Set(items.map(f => f.case_id))];
    if (caseIds.length > 0) {
      const { data: caseData } = await supabase
        .from("cases")
        .select("id, process_number, parties")
        .in("id", caseIds);
      const map: Record<string, CaseInfo> = {};
      (caseData || []).forEach(c => { map[c.id] = c; });
      setCases(map);
    }

    // Fetch profile info
    const userIds = [...new Set([...items.map(f => f.assigned_to), ...items.map(f => f.assigned_by)])];
    if (userIds.length > 0) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      const map: Record<string, ProfileInfo> = {};
      (profileData || []).forEach(p => { map[p.user_id] = p; });
      setProfiles(map);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [tenantId, statusFilter, categoryFilter, assignedFilter]);

  // Realtime
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel("fulfillments-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "case_fulfillments", filter: `tenant_id=eq.${tenantId}` }, () => {
        fetchData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, statusFilter, categoryFilter, assignedFilter]);

  const updateStatus = async (id: string, newStatus: string) => {
    const updates: any = { status: newStatus };
    if (newStatus === "concluido") updates.completed_at = new Date().toISOString();
    if (newStatus === "pendente" || newStatus === "em_andamento") updates.completed_at = null;

    const { error } = await supabase.from("case_fulfillments").update(updates).eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Status atualizado" });
      fetchData();
    }
  };

  const isOverdue = (dueDate: string, status: string) => {
    if (status === "concluido" || status === "cancelado") return false;
    return new Date(dueDate) < new Date(new Date().toISOString().split("T")[0]);
  };

  const pendingCount = fulfillments.filter(f => f.status === "pendente").length;
  const overdueCount = fulfillments.filter(f => isOverdue(f.due_date, f.status)).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display">Cumprimentos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ações pendentes nos processos
            {pendingCount > 0 && <span className="ml-2 text-accent font-medium">• {pendingCount} pendente(s)</span>}
            {overdueCount > 0 && <span className="ml-2 text-destructive font-medium">• {overdueCount} vencido(s)</span>}
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Cumprimento
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="em_andamento">Em Andamento</SelectItem>
            <SelectItem value="concluido">Concluídos</SelectItem>
            <SelectItem value="cancelado">Cancelados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assignedFilter} onValueChange={setAssignedFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Atribuição" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="mine">Meus cumprimentos</SelectItem>
            <SelectItem value="delegated">Delegados por mim</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
        </div>
      ) : fulfillments.length === 0 ? (
        <div className="text-center py-12">
          <ClipboardCheck className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum cumprimento encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {fulfillments.map((f, i) => {
            const c = cases[f.case_id];
            const overdue = isOverdue(f.due_date, f.status);
            return (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className={`bg-card border rounded-lg p-4 transition-all ${overdue ? "border-destructive/50" : ""} ${f.status === "concluido" ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{CATEGORY_LABELS[f.category] || f.category}</Badge>
                      <Badge variant={f.status === "concluido" ? "default" : f.status === "pendente" ? "secondary" : "outline"} className="text-[10px]">
                        {STATUS_LABELS[f.status] || f.status}
                      </Badge>
                      <span className="text-[10px]">{PRIORITY_LABELS[f.priority] || f.priority}</span>
                      {overdue && (
                        <span className="text-[10px] text-destructive font-medium flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Vencido
                        </span>
                      )}
                    </div>
                    {c && (
                      <Link to={`/processos/${c.id}`} className="text-sm font-mono text-accent hover:underline">
                        {c.process_number}
                      </Link>
                    )}
                    {c?.parties && <p className="text-xs text-muted-foreground mt-0.5">{c.parties}</p>}
                    {f.description && <p className="text-sm text-foreground mt-1">{f.description}</p>}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Prazo: {new Date(f.due_date + "T12:00:00").toLocaleDateString("pt-BR")}
                      </span>
                      <span>→ {profiles[f.assigned_to]?.full_name || "—"}</span>
                      <span className="text-muted-foreground/50">por {profiles[f.assigned_by]?.full_name || "—"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {f.status === "pendente" && (
                      <>
                        <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => updateStatus(f.id, "em_andamento")}>
                          Iniciar
                        </Button>
                        <Button variant="default" size="sm" className="text-xs h-7 gap-1" onClick={() => updateStatus(f.id, "concluido")}>
                          <CheckCircle2 className="w-3 h-3" /> Concluir
                        </Button>
                      </>
                    )}
                    {f.status === "em_andamento" && (
                      <Button variant="default" size="sm" className="text-xs h-7 gap-1" onClick={() => updateStatus(f.id, "concluido")}>
                        <CheckCircle2 className="w-3 h-3" /> Concluir
                      </Button>
                    )}
                    {f.status === "concluido" && (
                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => updateStatus(f.id, "pendente")}>
                        Reabrir
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <FulfillmentModal open={modalOpen} onOpenChange={setModalOpen} onCreated={fetchData} />
    </div>
  );
};

export default Cumprimentos;
