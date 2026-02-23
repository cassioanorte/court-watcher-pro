import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { ClipboardCheck, ArrowRight, AlertTriangle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

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
  outro: "Outro",
};

interface FulfillmentSummary {
  id: string;
  case_id: string;
  category: string;
  due_date: string;
  priority: string;
  status: string;
  process_number?: string;
}

const DashboardFulfillments = () => {
  const { tenantId } = useAuth();
  const [items, setItems] = useState<FulfillmentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("case_fulfillments")
        .select("id, case_id, category, due_date, priority, status")
        .eq("tenant_id", tenantId)
        .in("status", ["pendente", "em_andamento"])
        .order("due_date", { ascending: true })
        .limit(8);

      if (!data || data.length === 0) { setItems([]); setLoading(false); return; }

      const caseIds = [...new Set(data.map(d => d.case_id))];
      const { data: cases } = await supabase.from("cases").select("id, process_number").in("id", caseIds);
      const caseMap: Record<string, string> = {};
      (cases || []).forEach(c => { caseMap[c.id] = c.process_number; });

      setItems(data.map(d => ({ ...d, process_number: caseMap[d.case_id] || "—" })));
      setLoading(false);
    };
    fetch();
  }, [tenantId]);

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
                <Link key={item.id} to="/cumprimentos" className={`block rounded-md border p-3 hover:border-accent/30 transition-all ${overdue ? "border-destructive/30" : ""}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px]">{CATEGORY_LABELS[item.category] || item.category}</Badge>
                    <span className="text-[10px] font-mono text-muted-foreground">{item.process_number}</span>
                    {item.priority === "urgente" && <span className="text-[10px]">🔴</span>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span className={overdue ? "text-destructive font-medium" : ""}>
                      {new Date(item.due_date + "T12:00:00").toLocaleDateString("pt-BR")}
                    </span>
                    {overdue && <span className="text-destructive text-[10px]">Vencido</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default DashboardFulfillments;
