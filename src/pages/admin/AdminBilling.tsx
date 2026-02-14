import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Building2, DollarSign, Pencil, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TenantBilling {
  id: string;
  name: string;
  slug: string;
  monthly_fee: number;
  subscription_status: string;
  payment_status: string;
  userCount: number;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  active: { label: "Ativo", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  trial: { label: "Teste", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  overdue: { label: "Inadimplente", color: "text-red-400 bg-red-500/10 border-red-500/30" },
  blocked: { label: "Bloqueado", color: "text-red-400 bg-red-500/10 border-red-500/30" },
  exempt: { label: "Isento", color: "text-sky-400 bg-sky-500/10 border-sky-500/30" },
};

const AdminBilling = () => {
  const [tenants, setTenants] = useState<TenantBilling[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const { toast } = useToast();

  const fetchData = async () => {
    const [tenantsRes, profilesRes] = await Promise.all([
      supabase.from("tenants").select("id, name, slug, monthly_fee, subscription_status, payment_status"),
      supabase.from("profiles").select("tenant_id"),
    ]);
    const profiles = profilesRes.data || [];
    const usersByTenant: Record<string, number> = {};
    profiles.forEach((p) => { usersByTenant[p.tenant_id] = (usersByTenant[p.tenant_id] || 0) + 1; });

    setTenants(
      (tenantsRes.data || []).map((t: any) => ({
        ...t,
        monthly_fee: t.monthly_fee || 0,
        subscription_status: t.subscription_status || "active",
        payment_status: t.payment_status || "active",
        userCount: usersByTenant[t.id] || 0,
      }))
    );
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSaveFee = async (id: string) => {
    const fee = parseFloat(editValue);
    if (isNaN(fee) || fee < 0) {
      toast({ title: "Erro", description: "Valor inválido.", variant: "destructive" });
      return;
    }
    const updates: any = { monthly_fee: fee };
    // If fee is 0, auto-set as exempt
    if (fee === 0) {
      updates.subscription_status = "exempt";
    }
    const { error } = await supabase.from("tenants").update(updates).eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Mensalidade atualizada!" });
      setEditingId(null);
      fetchData();
    }
  };

  const handleChangeStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("tenants").update({
      subscription_status: status,
      blocked_at: status === "blocked" ? new Date().toISOString() : null,
    }).eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Status atualizado!" });
      fetchData();
    }
  };

  const totalRevenue = tenants.filter(t => t.subscription_status !== "exempt" && Number(t.monthly_fee) > 0).reduce((sum, t) => sum + Number(t.monthly_fee), 0);

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white font-display">Cobrança</h1>
        <p className="text-sm text-slate-400 mt-1">Gerencie as mensalidades dos escritórios</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Receita Mensal</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">R$ {totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </div>
        {Object.entries(statusConfig).map(([key, cfg]) => (
          <div key={key} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">{cfg.label}</p>
            <p className={`text-xl font-bold mt-1 ${cfg.color.split(" ")[0]}`}>{tenants.filter(t => t.subscription_status === key).length}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Carregando...</p>
      ) : (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden backdrop-blur">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-800">
                  <th className="px-5 py-3 font-medium">Escritório</th>
                  <th className="px-5 py-3 font-medium text-right">Usuários</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Mensalidade</th>
                  <th className="px-5 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t, i) => {
                  const cfg = statusConfig[t.subscription_status] || statusConfig.active;
                  return (
                    <motion.tr key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-600/20 border border-violet-500/30 flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-violet-400" />
                          </div>
                          <div>
                            <span className="text-white font-medium block">{t.name}</span>
                            <span className="text-xs text-slate-500">{t.slug}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right text-slate-300">{t.userCount}</td>
                      <td className="px-5 py-3">
                        <select
                          value={t.subscription_status}
                          onChange={(e) => handleChangeStatus(t.id, e.target.value)}
                          className="h-7 px-2 rounded bg-slate-800 border border-slate-700 text-xs text-white focus:ring-1 focus:ring-violet-500/40 focus:outline-none cursor-pointer"
                        >
                          <option value="active">Ativo</option>
                          <option value="trial">Teste</option>
                          <option value="overdue">Inadimplente</option>
                          <option value="blocked">Bloqueado</option>
                          <option value="exempt">Isento</option>
                        </select>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {editingId === t.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-slate-500 text-xs">R$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-24 h-7 px-2 rounded bg-slate-800 border border-slate-600 text-sm text-white text-right focus:ring-1 focus:ring-violet-500/40 focus:outline-none"
                              autoFocus
                              onKeyDown={(e) => { if (e.key === "Enter") handleSaveFee(t.id); if (e.key === "Escape") setEditingId(null); }}
                            />
                            <button onClick={() => handleSaveFee(t.id)} className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setEditingId(null)} className="p-1 text-slate-400 hover:bg-slate-700 rounded"><X className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <span className={`font-medium ${Number(t.monthly_fee) === 0 ? "text-slate-500" : "text-emerald-400"}`}>
                            {Number(t.monthly_fee) === 0 ? "Gratuito" : `R$ ${Number(t.monthly_fee).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {editingId !== t.id && (
                          <button onClick={() => { setEditingId(t.id); setEditValue(String(t.monthly_fee)); }} className="p-1.5 rounded-lg text-slate-400 hover:text-violet-400 hover:bg-violet-500/10 transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {tenants.length === 0 && <p className="text-center py-8 text-slate-500 text-sm">Nenhum escritório encontrado.</p>}
        </div>
      )}
    </div>
  );
};

export default AdminBilling;
