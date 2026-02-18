import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Building2, Plus, Search, Pencil, Trash2, X, Clock, DollarSign, Users, Scale, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  website: string | null;
  whatsapp: string | null;
  monthly_fee: number;
  trial_ends_at: string | null;
  trial_duration_days: number | null;
  subscription_status: string;
  created_at: string;
  userCount: number;
  caseCount: number;
  ownerUserId?: string;
  ownerName?: string;
  ownerEmail?: string;
}

interface TenantForm {
  name: string;
  slug: string;
  website: string;
  whatsapp: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  monthly_fee: string;
  trial_duration_days: string;
  ai_credits_limit: string;
}

const defaultForm: TenantForm = {
  name: "", slug: "", website: "", whatsapp: "",
  ownerName: "", ownerEmail: "", ownerPassword: "",
  monthly_fee: "0", trial_duration_days: "",
  ai_credits_limit: "0",
};

const trialOptions = [
  { label: "7 dias", value: 7 },
  { label: "15 dias", value: 15 },
  { label: "30 dias", value: 30 },
];

const getTrialStatus = (tenant: Tenant) => {
  if (!tenant.trial_ends_at) return null;
  const now = new Date();
  const end = new Date(tenant.trial_ends_at);
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return { label: "Expirado", color: "text-red-400 bg-red-500/10 border-red-500/30" };
  return { label: `${diff}d restantes`, color: "text-amber-400 bg-amber-500/10 border-amber-500/30" };
};

const AdminTenants = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<TenantForm>(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [detailTenant, setDetailTenant] = useState<Tenant | null>(null);
  const [detailUsers, setDetailUsers] = useState<{ full_name: string; role: string }[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const { toast } = useToast();

  const handleViewDetail = async (tenant: Tenant) => {
    setDetailTenant(tenant);
    setLoadingDetail(true);
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

      setDetailUsers(
        profiles.map((p) => ({
          full_name: p.full_name,
          role: roleMap[p.user_id] || "unknown",
        }))
      );
    } else {
      setDetailUsers([]);
    }
    setLoadingDetail(false);
  };

  const fetchTenants = async () => {
    const [tenantsRes, profilesRes, casesRes, rolesRes] = await Promise.all([
      supabase.from("tenants").select("*"),
      supabase.from("profiles").select("tenant_id, user_id, full_name"),
      supabase.from("cases").select("tenant_id"),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    const profiles = profilesRes.data || [];
    const cases = casesRes.data || [];
    const roles = rolesRes.data || [];
    const usersByTenant: Record<string, number> = {};
    const casesByTenant: Record<string, number> = {};
    profiles.forEach((p) => { usersByTenant[p.tenant_id] = (usersByTenant[p.tenant_id] || 0) + 1; });
    cases.forEach((c) => { casesByTenant[c.tenant_id] = (casesByTenant[c.tenant_id] || 0) + 1; });

    const ownerUserIds = new Set(roles.filter((r) => r.role === "owner").map((r) => r.user_id));
    const ownerByTenant: Record<string, { userId: string; name: string }> = {};
    profiles.forEach((p) => {
      if (ownerUserIds.has(p.user_id) && !ownerByTenant[p.tenant_id]) {
        ownerByTenant[p.tenant_id] = { userId: p.user_id, name: p.full_name };
      }
    });

    setTenants(
      (tenantsRes.data || []).map((t: any) => ({
        ...t,
        monthly_fee: t.monthly_fee || 0,
        subscription_status: t.subscription_status || "active",
        userCount: usersByTenant[t.id] || 0,
        caseCount: casesByTenant[t.id] || 0,
        ownerUserId: ownerByTenant[t.id]?.userId,
        ownerName: ownerByTenant[t.id]?.name,
      }))
    );
    setLoading(false);
  };

  useEffect(() => { fetchTenants(); }, []);

  const handleCreate = async () => {
    if (!form.name || !form.ownerName || !form.ownerEmail || !form.ownerPassword) {
      toast({ title: "Erro", description: "Preencha todos os campos obrigatórios.", variant: "destructive" });
      return;
    }
    if (form.ownerPassword.length < 6) {
      toast({ title: "Erro", description: "A senha deve ter no mínimo 6 caracteres.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("signup-owner", {
        body: {
          email: form.ownerEmail,
          password: form.ownerPassword,
          fullName: form.ownerName,
          firmName: form.name,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.tenantId) {
        const updates: any = {};
        if (form.website) updates.website = form.website;
        if (form.whatsapp) updates.whatsapp = form.whatsapp;
        updates.monthly_fee = parseFloat(form.monthly_fee) || 0;
        updates.ai_credits_limit = parseInt(form.ai_credits_limit) || 0;
        updates.subscription_status = form.trial_duration_days ? "trial" : "active";
        if (form.trial_duration_days) {
          const days = parseInt(form.trial_duration_days);
          const trialEnd = new Date();
          trialEnd.setDate(trialEnd.getDate() + days);
          updates.trial_ends_at = trialEnd.toISOString();
          updates.trial_duration_days = days;
        }
        await supabase.from("tenants").update(updates).eq("id", data.tenantId);
      }

      toast({ title: "Escritório criado!", description: `${form.name} foi criado com o dono ${form.ownerName}.` });
      setShowCreate(false);
      setForm(defaultForm);
      fetchTenants();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingTenant) return;
    setSubmitting(true);
    try {
      const updates: any = {
        name: form.name,
        website: form.website || null,
        whatsapp: form.whatsapp || null,
        monthly_fee: parseFloat(form.monthly_fee) || 0,
        ai_credits_limit: parseInt(form.ai_credits_limit) || 0,
      };

      if (form.trial_duration_days) {
        const days = parseInt(form.trial_duration_days);
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + days);
        updates.trial_ends_at = trialEnd.toISOString();
        updates.trial_duration_days = days;
        updates.subscription_status = "trial";
      }

      const { error } = await supabase.from("tenants").update(updates).eq("id", editingTenant.id);
      if (error) throw error;

      if (editingTenant.ownerUserId && form.ownerName) {
        await supabase.from("profiles").update({ full_name: form.ownerName }).eq("user_id", editingTenant.ownerUserId);
      }

      if (editingTenant.ownerUserId && form.ownerPassword && form.ownerPassword.length >= 6) {
        await supabase.functions.invoke("manage-team-member", {
          body: { action: "update", target_user_id: editingTenant.ownerUserId, updates: { new_password: form.ownerPassword } },
        });
      }

      toast({ title: "Escritório atualizado!" });
      setEditingTenant(null);
      fetchTenants();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivateTrial = async (tenantId: string, days: number) => {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + days);
    const { error } = await supabase.from("tenants").update({
      trial_ends_at: trialEnd.toISOString(),
      trial_duration_days: days,
      subscription_status: "trial",
    }).eq("id", tenantId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Teste ativado!", description: `Período de teste de ${days} dias ativado.` });
      fetchTenants();
    }
  };

  const handleCancelTrial = async (tenantId: string) => {
    const { error } = await supabase.from("tenants").update({
      trial_ends_at: null,
      trial_duration_days: null,
      subscription_status: "active",
    }).eq("id", tenantId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Teste cancelado!" });
      fetchTenants();
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir "${name}"? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from("tenants").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Escritório excluído!" });
      fetchTenants();
    }
  };

  const filtered = tenants.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));

  const inputClass = "w-full mt-1 h-9 px-3 rounded-lg bg-slate-800 border border-slate-600 text-sm text-white focus:ring-2 focus:ring-violet-500/40 focus:outline-none";
  const disabledInputClass = "w-full mt-1 h-9 px-3 rounded-lg bg-slate-800/50 border border-slate-700 text-sm text-slate-500 cursor-not-allowed focus:outline-none";

  const BillingFields = ({ isEdit }: { isEdit?: boolean }) => (
    <>
      <div className="border-t border-slate-700 pt-3 mt-3">
        <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-3">Cobrança e Teste</p>
      </div>
      <div>
        <label className="text-xs text-slate-400 uppercase">Mensalidade (R$)</label>
        <div className="relative">
          <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.monthly_fee}
            onChange={(e) => setForm({ ...form, monthly_fee: e.target.value })}
            className="w-full mt-1 h-9 pl-9 pr-3 rounded-lg bg-slate-800 border border-slate-600 text-sm text-white focus:ring-2 focus:ring-violet-500/40 focus:outline-none"
            placeholder="0.00"
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-slate-400 uppercase">Créditos de IA / mês</label>
        <div className="relative">
          <Sparkles className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="number"
            min="0"
            value={form.ai_credits_limit}
            onChange={(e) => setForm({ ...form, ai_credits_limit: e.target.value })}
            className="w-full mt-1 h-9 pl-9 pr-3 rounded-lg bg-slate-800 border border-slate-600 text-sm text-white focus:ring-2 focus:ring-violet-500/40 focus:outline-none"
            placeholder="0 = sem IA"
          />
        </div>
        <p className="text-[10px] text-slate-600 mt-1">0 = plano sem IA. Exemplo: 50, 100, 200</p>
      </div>
      <div>
        <label className="text-xs text-slate-400 uppercase">Período de teste</label>
        <div className="flex gap-2 mt-1">
          {trialOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setForm({ ...form, trial_duration_days: form.trial_duration_days === String(opt.value) ? "" : String(opt.value) })}
              className={`flex-1 h-9 rounded-lg text-xs font-semibold border transition-all ${
                form.trial_duration_days === String(opt.value)
                  ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                  : "bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {isEdit && editingTenant?.trial_ends_at && (
          <p className="text-[10px] text-slate-500 mt-1">
            Selecionar um período reiniciará o teste a partir de hoje.
          </p>
        )}
      </div>
    </>
  );

  const OwnerFields = ({ isEdit }: { isEdit?: boolean }) => (
    <>
      <div className="border-t border-slate-700 pt-3 mt-3">
        <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-3">Dados do dono (login)</p>
      </div>
      <div>
        <label className="text-xs text-slate-400 uppercase">Nome completo do dono {!isEdit && "*"}</label>
        <input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} className={inputClass} placeholder="Dr. João Silva" />
      </div>
      <div>
        <label className="text-xs text-slate-400 uppercase">Email do dono {!isEdit && "*"}</label>
        {isEdit ? (
          <>
            <input type="email" value={form.ownerEmail} disabled className={disabledInputClass} />
            <p className="text-[10px] text-slate-600 mt-1">O email não pode ser alterado.</p>
          </>
        ) : (
          <input type="email" value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} className={inputClass} placeholder="joao@escritorio.com" />
        )}
      </div>
      <div>
        <label className="text-xs text-slate-400 uppercase">{isEdit ? "Nova senha (opcional)" : "Senha *"}</label>
        <input type="password" value={form.ownerPassword} onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })} className={inputClass} placeholder={isEdit ? "Deixe em branco para manter" : "Mínimo 6 caracteres"} />
      </div>
    </>
  );

  const TenantFields = () => (
    <>
      <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Dados do escritório</p>
      <div>
        <label className="text-xs text-slate-400 uppercase">Nome do escritório *</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="Silva & Associados" />
      </div>
      <div>
        <label className="text-xs text-slate-400 uppercase">Website</label>
        <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className={inputClass} placeholder="https://www.escritorio.com.br" />
      </div>
      <div>
        <label className="text-xs text-slate-400 uppercase">WhatsApp</label>
        <input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className={inputClass} placeholder="(51) 99999-0000" />
      </div>
    </>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">Escritórios</h1>
          <p className="text-sm text-slate-400 mt-1">{tenants.length} escritório{tenants.length !== 1 ? "s" : ""} registrado{tenants.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => { setShowCreate(true); setForm(defaultForm); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 text-white text-sm font-semibold shadow-lg shadow-violet-500/25 hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" /> Novo Escritório
        </button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input type="text" placeholder="Buscar escritório..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-10 pl-9 pr-4 rounded-lg bg-slate-900/60 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40" />
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
                  <th className="px-5 py-3 font-medium text-right">Processos</th>
                  <th className="px-5 py-3 font-medium text-right">Mensalidade</th>
                  <th className="px-5 py-3 font-medium">Teste</th>
                  <th className="px-5 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => {
                  const trial = getTrialStatus(t);
                  return (
                    <motion.tr key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleViewDetail(t)}>
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-600/20 border border-violet-500/30 flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-violet-400" />
                          </div>
                          <div>
                            <span className="text-white font-medium block hover:text-violet-300 transition-colors">{t.name}</span>
                            <span className="text-xs text-slate-500">{t.slug}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right text-slate-300">{t.userCount}</td>
                      <td className="px-5 py-3 text-right text-slate-300">{t.caseCount}</td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-emerald-400 font-medium">
                          R$ {Number(t.monthly_fee).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {trial ? (
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${trial.color}`}>
                              <Clock className="w-3 h-3" />
                              {trial.label}
                            </span>
                            <button onClick={() => handleCancelTrial(t.id)} className="text-xs text-slate-500 hover:text-red-400 transition-colors">✕</button>
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            {trialOptions.map((opt) => (
                              <button key={opt.value} onClick={() => handleActivateTrial(t.id, opt.value)} className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 border border-slate-700 text-slate-400 hover:border-violet-500/40 hover:text-violet-300 transition-all">
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => {
                            setEditingTenant(t);
                            setForm({
                              ...defaultForm,
                              name: t.name,
                              slug: t.slug,
                              website: t.website || "",
                              whatsapp: t.whatsapp || "",
                              ownerName: t.ownerName || "",
                              ownerEmail: t.ownerEmail || "",
                               monthly_fee: String(t.monthly_fee || 0),
                               trial_duration_days: "",
                               ai_credits_limit: String((t as any).ai_credits_limit || 0),
                            });
                          }} className="p-1.5 rounded-lg text-slate-400 hover:text-violet-400 hover:bg-violet-500/10 transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(t.id, t.name)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && <p className="text-center py-8 text-slate-500 text-sm">Nenhum escritório encontrado.</p>}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Novo Escritório</h3>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <TenantFields />
              <BillingFields />
              <OwnerFields />
            </div>
            <button onClick={handleCreate} disabled={submitting} className="w-full mt-4 h-9 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              {submitting ? "Criando..." : "Criar escritório"}
            </button>
          </motion.div>
        </div>
      )}

      {/* Edit Modal */}
      {editingTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Editar Escritório</h3>
              <button onClick={() => setEditingTenant(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <TenantFields />
              <BillingFields isEdit />
              <OwnerFields isEdit />
            </div>
            <button onClick={handleUpdate} disabled={submitting} className="w-full mt-4 h-9 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              {submitting ? "Salvando..." : "Salvar alterações"}
            </button>
          </motion.div>
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={!!detailTenant} onOpenChange={() => setDetailTenant(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>{detailTenant?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="bg-slate-800/60 rounded-lg p-3 text-center">
              <Users className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
              <p className="text-xl font-bold">{detailTenant?.userCount}</p>
              <p className="text-xs text-slate-400">Usuários</p>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-3 text-center">
              <Scale className="w-5 h-5 text-amber-400 mx-auto mb-1" />
              <p className="text-xl font-bold">{detailTenant?.caseCount}</p>
              <p className="text-xs text-slate-400">Processos</p>
            </div>
          </div>
          {loadingDetail ? (
            <p className="text-slate-400 text-sm mt-4">Carregando usuários...</p>
          ) : (
            <div className="mt-4 space-y-4 max-h-72 overflow-y-auto">
              {(() => {
                const staff = detailUsers.filter((u) => u.role === "owner" || u.role === "staff");
                const clients = detailUsers.filter((u) => u.role === "client");
                const roleLabel = (role: string) => {
                  const map: Record<string, string> = { owner: "Proprietário", staff: "Equipe", client: "Cliente" };
                  return map[role] || role;
                };
                return (
                  <>
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
                  </>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTenants;
