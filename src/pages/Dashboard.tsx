import { motion } from "framer-motion";
import { Scale, Users, AlertTriangle, TrendingUp, ArrowRight, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const Dashboard = () => {
  const { tenantId } = useAuth();
  const [casesCount, setCasesCount] = useState(0);
  const [clientsCount, setClientsCount] = useState(0);
  const [recentMovements, setRecentMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const sourceLabels: Record<string, string> = {
    TJRS_1G: "TJRS - 1º Grau", TJRS_2G: "TJRS - 2º Grau",
    TRF4_JFRS: "TRF4 - JFRS", TRF4_JFSC: "TRF4 - JFSC", TRF4_JFPR: "TRF4 - JFPR",
  };

  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      const [casesRes, profilesRes, movementsRes] = await Promise.all([
        supabase.from("cases").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
        supabase.from("profiles").select("user_id").eq("tenant_id", tenantId),
        supabase.from("movements").select("*, cases!inner(process_number, source, tenant_id, id)").eq("cases.tenant_id", tenantId).order("occurred_at", { ascending: false }).limit(8),
      ]);

      setCasesCount(casesRes.count || 0);

      // Count only clients
      if (profilesRes.data && profilesRes.data.length > 0) {
        const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("user_id", profilesRes.data.map(p => p.user_id));
        setClientsCount((roles || []).filter(r => r.role === "client").length);
      }

      setRecentMovements(movementsRes.data || []);
      setLoading(false);
    };
    load();
  }, [tenantId]);

  const formatTime = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `Há ${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Há ${hours}h`;
    return `Há ${Math.floor(hours / 24)}d`;
  };

  const stats = [
    { label: "Processos Ativos", value: casesCount, icon: Scale, link: "/processos" },
    { label: "Clientes", value: clientsCount, icon: Users, link: "/clientes" },
    { label: "Movimentações", value: recentMovements.length, icon: TrendingUp, link: "/processos" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral do escritório</p>
      </div>

      {/* Stats - clickable */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Link to={stat.link} className="block bg-card rounded-lg p-5 shadow-card border hover:shadow-card-hover hover:border-accent/30 transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.label}</p>
                  <p className="text-3xl font-bold text-foreground mt-1 font-display">{loading ? "–" : stat.value}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-accent/15 flex items-center justify-center">
                  <stat.icon className="w-5 h-5 text-accent" />
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Recent movements - clickable rows */}
      <div className="bg-card rounded-lg shadow-card border">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-base font-semibold text-foreground">Movimentações Recentes</h2>
          <Link to="/processos" className="text-xs text-accent hover:underline flex items-center gap-1">
            Ver todos <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="divide-y">
          {loading ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">Carregando...</p>
          ) : recentMovements.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">Nenhuma movimentação registrada ainda.</p>
          ) : (
            recentMovements.map((mov, i) => (
              <motion.div key={mov.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.05 }}>
                <Link
                  to={`/processos/${mov.cases?.id || mov.case_id}`}
                  className="flex items-start gap-4 px-5 py-3.5 hover:bg-muted/50 transition-colors"
                >
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-accent" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{mov.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">{mov.cases?.process_number}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {sourceLabels[mov.cases?.source] || ""}
                    </span>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center justify-end gap-1">
                      <Clock className="w-3 h-3" /> {formatTime(mov.occurred_at)}
                    </p>
                  </div>
                </Link>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
