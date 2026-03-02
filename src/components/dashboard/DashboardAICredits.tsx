import { motion } from "framer-motion";
import { Brain, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Progress } from "@/components/ui/progress";

interface Props {
  compact?: boolean;
}

const DashboardAICredits = ({ compact = false }: Props) => {
  const { tenantId } = useAuth();
  const [used, setUsed] = useState(0);
  const [limit, setLimit] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      const { data } = await supabase
        .from("tenants")
        .select("ai_credits_limit, ai_credits_used")
        .eq("id", tenantId)
        .single();
      if (data) {
        setUsed((data as any).ai_credits_used || 0);
        setLimit((data as any).ai_credits_limit || 0);
      }
      setLoading(false);
    };
    load();
  }, [tenantId]);

  const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const remaining = Math.max(limit - used, 0);
  const isLow = limit > 0 && percentage >= 80;
  const isExhausted = limit > 0 && used >= limit;

  if (compact) {
    return (
      <div className="bg-card rounded-xl border shadow-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
            <Brain className="w-4.5 h-4.5 text-violet-300" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Créditos de IA</p>
            <p className="text-lg font-bold text-foreground">
              {loading ? "–" : `${used} / ${limit}`}
            </p>
          </div>
        </div>
        {!loading && limit > 0 && (
          <>
            <Progress value={percentage} className="h-2" />
            <p className={`text-xs ${isExhausted ? "text-destructive" : isLow ? "text-orange-400" : "text-muted-foreground"}`}>
              {isExhausted
                ? "Créditos esgotados — contate o suporte"
                : isLow
                  ? `Apenas ${remaining} crédito(s) restante(s)`
                  : `${remaining} crédito(s) disponível(is) este mês`}
            </p>
          </>
        )}
        {!loading && limit === 0 && (
          <p className="text-xs text-muted-foreground">IA não habilitada no plano atual</p>
        )}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12, duration: 0.4 }}
    >
      <div className="relative overflow-hidden rounded-xl p-5 bg-card border border-border shadow-card group">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-violet-400/70 to-transparent opacity-60" />
        <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-violet-500/5 -translate-y-8 translate-x-8" />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="w-11 h-11 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <Brain className="w-5 h-5 text-violet-300" />
            </div>
            {!loading && limit > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Sparkles className="w-3.5 h-3.5" />
                {percentage.toFixed(0)}% usado
              </div>
            )}
          </div>

          <p className="text-3xl font-bold tracking-tight font-display text-foreground">
            {loading ? "–" : `${used}/${limit}`}
          </p>
          <p className="text-xs text-muted-foreground mt-1 font-medium uppercase tracking-wide">
            Créditos de IA
          </p>

          {!loading && limit > 0 && (
            <div className="mt-3 space-y-1">
              <Progress value={percentage} className="h-1.5" />
              <p className={`text-[10px] ${isExhausted ? "text-destructive" : isLow ? "text-orange-400" : "text-muted-foreground"}`}>
                {isExhausted
                  ? "Esgotados — contate o suporte para ampliar"
                  : isLow
                    ? `⚠️ Apenas ${remaining} restante(s)`
                    : `${remaining} disponível(is) este mês`}
              </p>
            </div>
          )}
          {!loading && limit === 0 && (
            <p className="text-[10px] text-muted-foreground mt-2">IA não habilitada</p>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default DashboardAICredits;
