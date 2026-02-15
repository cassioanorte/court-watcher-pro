import { motion } from "framer-motion";
import { Scale, Users, TrendingUp, Newspaper, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardCalendar from "@/components/DashboardCalendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Publication {
  id: string;
  title: string;
  source: string;
  publication_type: string | null;
  process_number: string | null;
  read: boolean;
  publication_date: string;
}

const Dashboard = () => {
  const { tenantId } = useAuth();
  const [casesCount, setCasesCount] = useState(0);
  const [clientsCount, setClientsCount] = useState(0);
  const [movementsCount, setMovementsCount] = useState(0);
  const [todayPubs, setTodayPubs] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      const today = new Date().toISOString().split('T')[0];
      const [casesRes, profilesRes, movementsRes, pubsRes] = await Promise.all([
        supabase.from("cases").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
        supabase.from("profiles").select("user_id").eq("tenant_id", tenantId),
        supabase.from("movements").select("id", { count: "exact", head: true }),
        supabase.from("dje_publications").select("id, title, source, publication_type, process_number, read, publication_date").eq("tenant_id", tenantId).eq("publication_date", today).order("created_at", { ascending: false }).limit(10),
      ]);

      setCasesCount(casesRes.count || 0);
      setMovementsCount(movementsRes.count || 0);
      setTodayPubs((pubsRes.data || []) as Publication[]);

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

      {/* Today's Publications */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="bg-card rounded-lg border shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Newspaper className="w-5 h-5 text-accent" />
              <h2 className="font-semibold text-foreground">Publicações de Hoje</h2>
              {todayPubs.length > 0 && (
                <Badge variant="secondary" className="text-xs">{todayPubs.length}</Badge>
              )}
            </div>
            <Button variant="ghost" size="sm" asChild className="gap-1 text-muted-foreground">
              <Link to="/publicacoes">
                Ver todas <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
          {todayPubs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma publicação hoje</p>
          ) : (
            <div className="space-y-2">
              {todayPubs.map(pub => (
                <Link key={pub.id} to="/publicacoes" className={`block rounded-md border p-3 hover:border-accent/30 transition-all ${!pub.read ? "border-l-4 border-l-accent" : ""}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px]">{pub.source}</Badge>
                    {pub.publication_type && (
                      <span className="text-[10px] text-muted-foreground">{pub.publication_type}</span>
                    )}
                    {!pub.read && <span className="w-2 h-2 rounded-full bg-accent" />}
                  </div>
                  <p className={`text-sm line-clamp-1 ${pub.read ? "text-muted-foreground" : "text-foreground font-medium"}`}>
                    {pub.title}
                  </p>
                  {pub.process_number && (
                    <p className="text-xs text-muted-foreground font-mono mt-1">{pub.process_number}</p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      <DashboardCalendar />
    </div>
  );
};

export default Dashboard;
