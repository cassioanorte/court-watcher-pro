import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Building2, Users, Activity, TrendingUp, ChevronRight, Scale, Brain, Sparkles, DollarSign, Save } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface Stats {
  tenants: number;
  users: number;
  recentLogs: number;
  totalAICredits: number;
  totalAIUsed: number;
}

interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  userCount: number;
  caseCount: number;
}

interface TenantUser {
  full_name: string;
  role: string;
}

const AdminDashboard = () => {
  const [stats, setStats] = useState<Stats>({ tenants: 0, users: 0, recentLogs: 0, totalAICredits: 0, totalAIUsed: 0 });
  const [topTenants, setTopTenants] = useState<TenantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<TenantSummary | null>(null);
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const [tenantsRes, profilesRes, casesRes, logsRes, rolesRes] = await Promise.all([
        supabase.from("tenants").select("id, name, slug, created_at"),
        supabase.from("profiles").select("tenant_id, user_id"),
        supabase.from("cases").select("tenant_id"),
        supabase.from("audit_logs").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      const tenants = tenantsRes.data || [];
      const profiles = profilesRes.data || [];
      const cases = casesRes.data || [];
      const roles = rolesRes.data || [];

      // Count only staff users (owner/staff), not clients
      const clientUserIds = new Set(roles.filter((r) => r.role === "client").map((r) => r.user_id));
      const staffProfiles = profiles.filter((p) => !clientUserIds.has(p.user_id));

      // AI credits totals
      let totalAICredits = 0;
      let totalAIUsed = 0;
      tenants.forEach((t: any) => {
        totalAICredits += (t.ai_credits_limit || 0);
        totalAIUsed += (t.ai_credits_used || 0);
      });

      setStats({
        tenants: tenants.length,
        users: staffProfiles.length,
        recentLogs: logsRes.count || 0,
        totalAICredits,
        totalAIUsed,
      });

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

  const handleSelectTenant = async (tenant: TenantSummary) => {
    setSelectedTenant(tenant);
    setLoadingUsers(true);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .eq("tenant_id", tenant.id);

    if (profiles && profiles.length > 0) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", profiles.map((p) => p.user_id));

      const roleMap: Record<string, string> = {};
      (roles || []).forEach((r) => { roleMap[r.user_id] = r.role; });

      setTenantUsers(
        profiles.map((p) => ({
          full_name: p.full_name,
          role: roleMap[p.user_id] || "unknown",
        }))
      );
    } else {
      setTenantUsers([]);
    }
    setLoadingUsers(false);
  };

  const staff = tenantUsers.filter((u) => u.role === "owner" || u.role === "staff");
  const clients = tenantUsers.filter((u) => u.role === "client");

  const roleLabel = (role: string) => {
    const map: Record<string, string> = { owner: "Proprietário", staff: "Equipe", client: "Cliente" };
    return map[role] || role;
  };

  const cards = [
    { label: "Escritórios", value: stats.tenants, icon: Building2, color: "from-violet-500 to-indigo-600", link: "/admin/escritorios" },
    { label: "Usuários do Escritório", value: stats.users, icon: Users, color: "from-emerald-500 to-teal-600", link: "/admin/usuarios" },
    { label: "Logs de Atividade", value: stats.recentLogs, icon: Activity, color: "from-rose-500 to-pink-600", link: "/admin/atividade" },
  ];

  const aiPercentage = stats.totalAICredits > 0 ? Math.round((stats.totalAIUsed / stats.totalAICredits) * 100) : 0;

  if (loading) return <p className="text-slate-400">Carregando...</p>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white font-display">Dashboard</h1>
        <p className="text-sm text-slate-400 mt-1">Visão geral do sistema</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <Link
              to={card.link}
              className="block bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur hover:border-slate-600 hover:bg-slate-800/60 transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg`}>
                  <card.icon className="w-5 h-5 text-white" />
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </div>
              <p className="text-2xl font-bold text-white">{card.value.toLocaleString("pt-BR")}</p>
              <p className="text-xs text-slate-400 mt-1">{card.label}</p>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* AI Credits Overview */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-violet-600/20 border border-purple-500/30 flex items-center justify-center">
              <Brain className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Créditos de IA — Visão Global</h2>
              <p className="text-xs text-slate-400">Total distribuído entre todos os escritórios</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-slate-800/60 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-white">{stats.totalAICredits.toLocaleString("pt-BR")}</p>
              <p className="text-xs text-slate-400 mt-1">Total Distribuído</p>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-purple-400">{stats.totalAIUsed.toLocaleString("pt-BR")}</p>
              <p className="text-xs text-slate-400 mt-1">Total Consumido</p>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-emerald-400">{(stats.totalAICredits - stats.totalAIUsed).toLocaleString("pt-BR")}</p>
              <p className="text-xs text-slate-400 mt-1">Disponível</p>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-amber-400">{aiPercentage}%</p>
              <p className="text-xs text-slate-400 mt-1">Utilização</p>
            </div>
          </div>
          <div className="mt-3 w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${aiPercentage >= 80 ? "bg-red-500" : aiPercentage >= 50 ? "bg-amber-500" : "bg-purple-500"}`}
              style={{ width: `${Math.min(aiPercentage, 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500 mt-1 text-right">
            Gerencie os créditos por escritório em <a href="/admin/escritorios" className="text-violet-400 hover:underline">Escritórios</a>
          </p>
        </div>
      </motion.div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur">
        <h2 className="text-lg font-semibold text-white mb-4">Top Escritórios por Processos</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-800">
                <th className="pb-3 font-medium">Escritório</th>
                <th className="pb-3 font-medium">Slug</th>
                <th className="pb-3 font-medium text-right">Criado em</th>
                <th className="pb-3 font-medium text-right"></th>
              </tr>
            </thead>
            <tbody>
              {topTenants.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => handleSelectTenant(t)}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer"
                >
                  <td className="py-3 text-white font-medium">{t.name}</td>
                  <td className="py-3 text-slate-400">{t.slug}</td>
                  <td className="py-3 text-right text-slate-400">{new Date(t.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="py-3 text-right"><ChevronRight className="w-4 h-4 text-slate-500 inline" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!selectedTenant} onOpenChange={() => setSelectedTenant(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedTenant?.name}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="bg-slate-800/60 rounded-lg p-3 text-center">
              <Users className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
              <p className="text-xl font-bold">{selectedTenant?.userCount}</p>
              <p className="text-xs text-slate-400">Usuários</p>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-3 text-center">
              <Scale className="w-5 h-5 text-amber-400 mx-auto mb-1" />
              <p className="text-xl font-bold">{selectedTenant?.caseCount}</p>
              <p className="text-xs text-slate-400">Processos</p>
            </div>
          </div>

          {loadingUsers ? (
            <p className="text-slate-400 text-sm mt-4">Carregando usuários...</p>
          ) : (
            <div className="mt-4 space-y-4 max-h-72 overflow-y-auto">
              {staff.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Equipe ({staff.length})</h3>
                  <ul className="space-y-1">
                    {staff.map((u, i) => (
                      <li key={i} className="flex items-center justify-between bg-slate-800/40 rounded-md px-3 py-2 text-sm">
                        <span className="text-white">{u.full_name}</span>
                        <span className="text-xs text-emerald-400">{roleLabel(u.role)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {clients.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Clientes ({clients.length})</h3>
                  <ul className="space-y-1">
                    {clients.map((u, i) => (
                      <li key={i} className="bg-slate-800/40 rounded-md px-3 py-2 text-sm text-white">
                        {u.full_name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {staff.length === 0 && clients.length === 0 && (
                <p className="text-sm text-slate-500">Nenhum usuário encontrado.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
