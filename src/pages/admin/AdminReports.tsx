import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, Building2, Users, Scale, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TenantReport {
  id: string;
  name: string;
  users: number;
  owners: number;
  staff: number;
  clients: number;
  cases: number;
  billingTotal: number;
  financialTotal: number;
}

const AdminReports = () => {
  const [reports, setReports] = useState<TenantReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [tenantsRes, profilesRes, rolesRes, casesRes, billingRes, financialRes] = await Promise.all([
        supabase.from("tenants").select("id, name"),
        supabase.from("profiles").select("user_id, tenant_id"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("cases").select("tenant_id"),
        supabase.from("billing_collections").select("tenant_id, amount"),
        supabase.from("financial_transactions").select("tenant_id, amount, type"),
      ]);

      const roleMap: Record<string, string[]> = {};
      (rolesRes.data || []).forEach((r) => {
        if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
        roleMap[r.user_id].push(r.role);
      });

      const tenants = tenantsRes.data || [];
      const profiles = profilesRes.data || [];
      const cases = casesRes.data || [];
      const billing = billingRes.data || [];
      const financial = financialRes.data || [];

      setReports(
        tenants.map((t) => {
          const tProfiles = profiles.filter((p) => p.tenant_id === t.id);
          const tRoles = tProfiles.flatMap((p) => roleMap[p.user_id] || []);
          return {
            id: t.id,
            name: t.name,
            users: tProfiles.length,
            owners: tRoles.filter((r) => r === "owner").length,
            staff: tRoles.filter((r) => r === "staff").length,
            clients: tRoles.filter((r) => r === "client").length,
            cases: cases.filter((c) => c.tenant_id === t.id).length,
            billingTotal: billing.filter((b) => b.tenant_id === t.id).reduce((sum, b) => sum + Number(b.amount), 0),
            financialTotal: financial.filter((f) => f.tenant_id === t.id && f.type === "income").reduce((sum, f) => sum + Number(f.amount), 0),
          };
        }).sort((a, b) => b.cases - a.cases)
      );
      setLoading(false);
    };
    fetchData();
  }, []);

  const totalCases = reports.reduce((s, r) => s + r.cases, 0);
  const totalBilling = reports.reduce((s, r) => s + r.billingTotal, 0);
  const totalRevenue = reports.reduce((s, r) => s + r.financialTotal, 0);

  if (loading) return <p className="text-slate-400">Carregando...</p>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white font-display">Relatórios</h1>
        <p className="text-sm text-slate-400 mt-1">Desempenho detalhado por escritório</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total de Processos", value: totalCases.toLocaleString("pt-BR"), icon: Scale, color: "from-amber-500 to-orange-600" },
          { label: "Cobranças Emitidas", value: `R$ ${totalBilling.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: DollarSign, color: "from-emerald-500 to-teal-600" },
          { label: "Receita Total", value: `R$ ${totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: BarChart3, color: "from-violet-500 to-indigo-600" },
        ].map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg mb-3`}>
              <card.icon className="w-5 h-5 text-white" />
            </div>
            <p className="text-xl font-bold text-white">{card.value}</p>
            <p className="text-xs text-slate-400 mt-1">{card.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden backdrop-blur">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-800">
              <th className="px-5 py-3 font-medium">Escritório</th>
              <th className="px-5 py-3 font-medium text-right">Donos</th>
              <th className="px-5 py-3 font-medium text-right">Staff</th>
              <th className="px-5 py-3 font-medium text-right">Clientes</th>
              <th className="px-5 py-3 font-medium text-right">Processos</th>
              <th className="px-5 py-3 font-medium text-right">Cobranças</th>
              <th className="px-5 py-3 font-medium text-right">Receita</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r, i) => (
              <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-violet-400" />
                    <span className="text-white font-medium">{r.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-right text-slate-300">{r.owners}</td>
                <td className="px-5 py-3 text-right text-slate-300">{r.staff}</td>
                <td className="px-5 py-3 text-right text-slate-300">{r.clients}</td>
                <td className="px-5 py-3 text-right text-slate-300">{r.cases}</td>
                <td className="px-5 py-3 text-right text-slate-300">R$ {r.billingTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                <td className="px-5 py-3 text-right text-emerald-400 font-medium">R$ {r.financialTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminReports;
