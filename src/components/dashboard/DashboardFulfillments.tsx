import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { ClipboardCheck, ArrowRight, AlertTriangle, Clock, Pencil, Trash2, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import FulfillmentModal, { type FulfillmentEditData } from "@/components/FulfillmentModal";

const CATEGORY_LABELS: Record<string, string> = {
  peticao: "Petição",
  recurso: "Recurso",
  cumprimento_despacho: "Cump. Despacho",
  audiencia_diligencia: "Audiência",
  contato_cliente: "Ligar Cliente",
  solicitar_documentacao: "Solicitar Doc.",
  manifestacao: "Manifestação",
  alvara: "Alvará",
  calculo: "Cálculo",
  providencia_administrativa: "Prov. Admin.",
  contestacao: "Contestação",
  replica: "Réplica",
  cumprimento_sentenca: "Cump. Sentença",
  outro: "Outro",
};

interface FulfillmentSummary {
  id: string;
  case_id: string;
  category: string;
  description: string | null;
  assigned_to: string;
  assigned_to_ids?: string[];
  due_date: string;
  priority: string;
  status: string;
  notes: string | null;
  process_number?: string;
  parties?: string;
}

const DashboardFulfillments = () => {
  const { tenantId } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<FulfillmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [editData, setEditData] = useState<FulfillmentEditData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchItems = async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from("case_fulfillments")
      .select("id, case_id, category, description, assigned_to, assigned_to_ids, due_date, priority, status, notes")
      .eq("tenant_id", tenantId)
      .in("status", ["pendente", "em_andamento"])
      .order("due_date", { ascending: true })
      .limit(8);

    if (!data || data.length === 0) { setItems([]); setLoading(false); return; }

    const caseIds = [...new Set(data.map(d => d.case_id))];
    const { data: cases } = await supabase.from("cases").select("id, process_number, parties").in("id", caseIds);
    const caseMap: Record<string, { process_number: string; parties: string | null }> = {};
    (cases || []).forEach(c => { caseMap[c.id] = { process_number: c.process_number, parties: c.parties }; });

    setItems(data.map(d => ({ ...d, process_number: caseMap[d.case_id]?.process_number || "—", parties: caseMap[d.case_id]?.parties || undefined })));
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, [tenantId]);

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este cumprimento?")) return;
    const { error } = await supabase.from("case_fulfillments").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Excluído" });
      fetchItems();
    }
  };

  const handleEdit = (item: FulfillmentSummary) => {
    setEditData({
      id: item.id,
      case_id: item.case_id,
      category: item.category,
      description: item.description,
      assigned_to: item.assigned_to,
      assigned_to_ids: item.assigned_to_ids || [],
      due_date: item.due_date,
      priority: item.priority,
      notes: item.notes,
    });
    setModalOpen(true);
  };

  const isOverdue = (dueDate: string) => new Date(dueDate) < new Date(new Date().toISOString().split("T")[0]);
  const overdueCount = items.filter(i => isOverdue(i.due_date)).length;

  if (loading) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
      <div className="bg-card rounded-xl border shadow-card p-5 h-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-accent" />
            <h2 className="font-semibold text-foreground">Cumprimentos Pendentes</h2>
            {items.length > 0 && <Badge variant="default" className="text-xs">{items.length}</Badge>}
            {overdueCount > 0 && (
              <Badge variant="destructive" className="text-xs gap-1">
                <AlertTriangle className="w-3 h-3" /> {overdueCount} vencido(s)
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" asChild className="gap-1 text-muted-foreground">
            <Link to="/cumprimentos">Ver todos <ArrowRight className="w-4 h-4" /></Link>
          </Button>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum cumprimento pendente 🎉</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {items.map(item => {
              const overdue = isOverdue(item.due_date);
              return (
                <div key={item.id} className={`rounded-md border p-3 transition-all ${overdue ? "border-destructive/30" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <Link to="/cumprimentos" className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px]">{CATEGORY_LABELS[item.category] || item.category}</Badge>
                        <span className="text-[10px] font-mono text-muted-foreground">{item.process_number}</span>
                        {item.priority === "urgente" && <span className="text-[10px]">🔴</span>}
                      </div>
                      {item.parties && <p className="text-xs text-muted-foreground truncate">{item.parties}</p>}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span className={overdue ? "text-destructive font-medium" : ""}>
                          {new Date(item.due_date + "T12:00:00").toLocaleDateString("pt-BR")}
                        </span>
                        {overdue && <span className="text-destructive text-[10px]">Vencido</span>}
                      </div>
                    </Link>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Ver processo" asChild>
                        <Link to={`/processos/${item.case_id}`}>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Editar" onClick={() => handleEdit(item)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" title="Excluir" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <FulfillmentModal
        open={modalOpen}
        onOpenChange={(open) => { setModalOpen(open); if (!open) setEditData(null); }}
        editData={editData}
        onCreated={fetchItems}
      />
    </motion.div>
  );
};

export default DashboardFulfillments;
