import { motion } from "framer-motion";
import { Scale, Users, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardCalendar from "@/components/DashboardCalendar";

const Dashboard = () => {
  const { tenantId } = useAuth();
  const [casesCount, setCasesCount] = useState(0);
  const [clientsCount, setClientsCount] = useState(0);
  const [movementsCount, setMovementsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      const [casesRes, profilesRes, movementsRes] = await Promise.all([
        supabase.from("cases").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
        supabase.from("profiles").select("user_id").eq("tenant_id", tenantId),
        supabase.from("movements").select("id", { count: "exact", head: true }),
      ]);

      setCasesCount(casesRes.count || 0);
      setMovementsCount(movementsRes.count || 0);

      if (profilesRes.data && profilesRes.data.length > 0) {
        const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("user_id", profilesRes.data.map(p => p.user_id));
        setClientsCount((roles || []).filter(r => r.role === "client").length);
      }

      setLoading(false);
    };
    load();
  }, [tenantId]);

  const stats = [
    { label: "Processos Ativos", value: casesCount, icon: Scale, link: "/processos" },
    { label: "Clientes", value: clientsCount, icon: Users, link: "/clientes" },
    { label: "Movimentações", value: movementsCount, icon: TrendingUp, link: "/processos" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral do escritório</p>
      </div>

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

      <DashboardCalendar />
    </div>
  );
};

export default Dashboard;
