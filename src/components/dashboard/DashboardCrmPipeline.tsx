import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STAGES = [
  { key: "contato_inicial", label: "Contato", color: "bg-[hsl(210,80%,55%)]" },
  { key: "reuniao_agendada", label: "Reunião", color: "bg-[hsl(38,80%,55%)]" },
  { key: "proposta_enviada", label: "Proposta", color: "bg-[hsl(280,60%,55%)]" },
  { key: "negociacao", label: "Negociação", color: "bg-[hsl(38,92%,50%)]" },
  { key: "fechado_ganho", label: "Ganho", color: "bg-[hsl(152,60%,42%)]" },
  { key: "fechado_perdido", label: "Perdido", color: "bg-destructive" },
] as const;

const DashboardCrmPipeline = () => {
  const { tenantId } = useAuth();
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({});
  const [totalValue, setTotalValue] = useState(0);

  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      const { data: leads } = await supabase
        .from("crm_leads")
        .select("stage, estimated_value")
        .eq("tenant_id", tenantId);

      if (!leads) return;
      const counts: Record<string, number> = {};
      let val = 0;
      leads.forEach((l) => {
        counts[l.stage] = (counts[l.stage] || 0) + 1;
        if (l.stage !== "fechado_perdido") val += Number(l.estimated_value || 0);
      });
      setStageCounts(counts);
      setTotalValue(val);
    };
    load();
  }, [tenantId]);

  const activeStages = STAGES.filter((s) => s.key !== "fechado_perdido" && s.key !== "fechado_ganho");
  const totalActive = activeStages.reduce((acc, s) => acc + (stageCounts[s.key] || 0), 0);
  const maxCount = Math.max(...activeStages.map((s) => stageCounts[s.key] || 0), 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-card rounded-xl border shadow-card p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-accent" />
          <h2 className="font-semibold text-foreground">Pipeline CRM</h2>
          {totalActive > 0 && (
            <Badge variant="default" className="text-xs">{totalActive} ativos</Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" asChild className="gap-1 text-muted-foreground">
          <Link to="/crm">
            Ver CRM <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>

      {totalActive === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum lead ativo no pipeline
        </p>
      ) : (
        <div className="space-y-3">
          {activeStages.map((stage) => {
            const count = stageCounts[stage.key] || 0;
            const pct = (count / maxCount) * 100;
            return (
              <div key={stage.key} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-20 shrink-0 text-right">
                  {stage.label}
                </span>
                <div className="flex-1 h-7 bg-muted rounded-md overflow-hidden relative">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(pct, count > 0 ? 8 : 0)}%` }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className={`h-full ${stage.color} rounded-md`}
                  />
                  {count > 0 && (
                    <span className="absolute inset-y-0 left-2 flex items-center text-xs font-semibold text-white drop-shadow">
                      {count}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {totalValue > 0 && (
            <p className="text-xs text-muted-foreground text-right mt-2">
              Valor potencial:{" "}
              <span className="font-semibold text-foreground">
                {totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </p>
          )}
        </div>
      )}

      <div className="flex gap-3 mt-3 pt-3 border-t">
        {(["fechado_ganho", "fechado_perdido"] as const).map((key) => {
          const stage = STAGES.find((s) => s.key === key)!;
          const count = stageCounts[key] || 0;
          return (
            <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`w-2 h-2 rounded-full ${stage.color}`} />
              {stage.label}: <span className="font-semibold text-foreground">{count}</span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default DashboardCrmPipeline;
