import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Building2, Users, Scale, TrendingUp, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Stats {
  tenants: number;
  users: number;
  cases: number;
  recentLogs: number;
}

interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  userCount: number;
  caseCount: number;
}

const AdminDashboard = () => {
  const [stats, setStats] = useState<Stats>({ tenants: 0, users: 0, cases: 0, recentLogs: 0 });
  const [topTenants, setTopTenants] = useState<TenantSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [tenantsRes, profilesRes, casesRes, logsRes] = await Promise.all([
        supabase.from("tenants").select("id, name, slug, created_at"),
        supabase.from("profiles").select("tenant_id"),
        supabase.from("cases").select("tenant_id"),
        supabase.from("audit_logs").select("id", { count: "exact", head: true }),
      ]);

      const tenants = tenantsRes.data || [];
      const profiles = profilesRes.data || [];
      const cases = casesRes.data || [];

      setStats({
        tenants: tenants.length,
        users: profiles.length,
        cases: cases.length,
        recentLogs: logsRes.count || 0,
      });

      // Build tenant summaries
      const usersByTenant: Record<string, number> = {};
      const casesByTenant: Record<string, number> = {};
      profiles.forEach((p) => { usersByTenant[p.tenant_id] = (usersByTenant[p.tenant_id] || 0) + 1; });
      cases.forEach((c) => { casesByTenant[c.tenant_id] = (casesByTenant[c.tenant_id] || 0) + 1; });

      const summaries: TenantSummary[] = tenants.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        created_at: t.created_at,
        userCount: usersByTenant[t.id] || 0,
        caseCount: casesByTenant[t.id] || 0,
      })).sort((a, b) => b.caseCount - a.caseCount).slice(0, 5);

      setTopTenants(summaries);
      setLoading(false);
    };
    fetchData();
  }, []);

  const cards = [
    { label: "Escritórios", value: stats.tenants, icon: Building2, color: "from-violet-500 to-indigo-600" },
    { label: "Usuários", value: stats.users, icon: Users, color: "from-emerald-500 to-teal-600" },
    { label: "Processos", value: stats.cases, icon: Scale, color: "from-amber-500 to-orange-600" },
    { label: "Logs de Atividade", value: stats.recentLogs, icon: Activity, color: "from-rose-500 to-pink-600" },
  ];

  if (loading) return <p className="text-slate-400">Carregando...</p>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white font-display">Dashboard</h1>
        <p className="text-sm text-slate-400 mt-1">Visão geral do sistema</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg`}>
                <card.icon className="w-5 h-5 text-white" />
              </div>
              <TrendingUp className="w-4 h-4 text-slate-500" />
            </div>
            <p className="text-2xl font-bold text-white">{card.value.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-slate-400 mt-1">{card.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur">
        <h2 className="text-lg font-semibold text-white mb-4">Top Escritórios por Processos</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-800">
                <th className="pb-3 font-medium">Escritório</th>
                <th className="pb-3 font-medium">Slug</th>
                <th className="pb-3 font-medium text-right">Usuários</th>
                <th className="pb-3 font-medium text-right">Processos</th>
                <th className="pb-3 font-medium text-right">Criado em</th>
              </tr>
            </thead>
            <tbody>
              {topTenants.map((t) => (
                <tr key={t.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 text-white font-medium">{t.name}</td>
                  <td className="py-3 text-slate-400">{t.slug}</td>
                  <td className="py-3 text-right text-slate-300">{t.userCount}</td>
                  <td className="py-3 text-right text-slate-300">{t.caseCount}</td>
                  <td className="py-3 text-right text-slate-400">{new Date(t.created_at).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
