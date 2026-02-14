import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Building2, Plus, Search, Pencil, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  website: string | null;
  whatsapp: string | null;
  created_at: string;
  userCount: number;
  caseCount: number;
}

const AdminTenants = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", website: "", whatsapp: "", ownerName: "", ownerEmail: "", ownerPassword: "" });
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const fetchTenants = async () => {
    const [tenantsRes, profilesRes, casesRes] = await Promise.all([
      supabase.from("tenants").select("*"),
      supabase.from("profiles").select("tenant_id"),
      supabase.from("cases").select("tenant_id"),
    ]);

    const profiles = profilesRes.data || [];
    const cases = casesRes.data || [];
    const usersByTenant: Record<string, number> = {};
    const casesByTenant: Record<string, number> = {};
    profiles.forEach((p) => { usersByTenant[p.tenant_id] = (usersByTenant[p.tenant_id] || 0) + 1; });
    cases.forEach((c) => { casesByTenant[c.tenant_id] = (casesByTenant[c.tenant_id] || 0) + 1; });

    setTenants(
      (tenantsRes.data || []).map((t) => ({
        ...t,
        userCount: usersByTenant[t.id] || 0,
        caseCount: casesByTenant[t.id] || 0,
      }))
    );
    setLoading(false);
  };

  useEffect(() => { fetchTenants(); }, []);

  const defaultForm = { name: "", slug: "", website: "", whatsapp: "", ownerName: "", ownerEmail: "", ownerPassword: "" };

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

      // Update optional fields on the tenant
      if (data?.tenantId && (form.website || form.whatsapp)) {
        await supabase.from("tenants").update({
          website: form.website || null,
          whatsapp: form.whatsapp || null,
        }).eq("id", data.tenantId);
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
    const { error } = await supabase.from("tenants").update({
      name: form.name,
      website: form.website || null,
      whatsapp: form.whatsapp || null,
    }).eq("id", editingTenant.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Escritório atualizado!" });
      setEditingTenant(null);
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

  const CreateModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Novo Escritório</h3>
          <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Dados do escritório</p>
          <div>
            <label className="text-xs text-slate-400 uppercase">Nome do escritório *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full mt-1 h-9 px-3 rounded-lg bg-slate-800 border border-slate-600 text-sm text-white focus:ring-2 focus:ring-violet-500/40 focus:outline-none" placeholder="Silva & Associados" />
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase">Website</label>
            <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="w-full mt-1 h-9 px-3 rounded-lg bg-slate-800 border border-slate-600 text-sm text-white focus:ring-2 focus:ring-violet-500/40 focus:outline-none" placeholder="https://www.escritorio.com.br" />
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase">WhatsApp</label>
            <input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className="w-full mt-1 h-9 px-3 rounded-lg bg-slate-800 border border-slate-600 text-sm text-white focus:ring-2 focus:ring-violet-500/40 focus:outline-none" placeholder="(51) 99999-0000" />
          </div>
          <div className="border-t border-slate-700 pt-3 mt-3">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-3">Dados do dono (login)</p>
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase">Nome completo do dono *</label>
            <input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} className="w-full mt-1 h-9 px-3 rounded-lg bg-slate-800 border border-slate-600 text-sm text-white focus:ring-2 focus:ring-violet-500/40 focus:outline-none" placeholder="Dr. João Silva" />
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase">Email do dono *</label>
            <input type="email" value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} className="w-full mt-1 h-9 px-3 rounded-lg bg-slate-800 border border-slate-600 text-sm text-white focus:ring-2 focus:ring-violet-500/40 focus:outline-none" placeholder="joao@escritorio.com" />
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase">Senha *</label>
            <input type="password" value={form.ownerPassword} onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })} className="w-full mt-1 h-9 px-3 rounded-lg bg-slate-800 border border-slate-600 text-sm text-white focus:ring-2 focus:ring-violet-500/40 focus:outline-none" placeholder="Mínimo 6 caracteres" />
          </div>
        </div>
        <button onClick={handleCreate} disabled={submitting} className="w-full mt-4 h-9 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
          {submitting ? "Criando..." : "Criar escritório"}
        </button>
      </motion.div>
    </div>
  );

  const EditModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Editar Escritório</h3>
          <button onClick={() => setEditingTenant(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 uppercase">Nome</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full mt-1 h-9 px-3 rounded-lg bg-slate-800 border border-slate-600 text-sm text-white focus:ring-2 focus:ring-violet-500/40 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase">Website</label>
            <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="w-full mt-1 h-9 px-3 rounded-lg bg-slate-800 border border-slate-600 text-sm text-white focus:ring-2 focus:ring-violet-500/40 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase">WhatsApp</label>
            <input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className="w-full mt-1 h-9 px-3 rounded-lg bg-slate-800 border border-slate-600 text-sm text-white focus:ring-2 focus:ring-violet-500/40 focus:outline-none" />
          </div>
        </div>
        <button onClick={handleUpdate} className="w-full mt-4 h-9 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity">
          Salvar
        </button>
      </motion.div>
    </div>
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
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-800">
                <th className="px-5 py-3 font-medium">Escritório</th>
                <th className="px-5 py-3 font-medium">Slug</th>
                <th className="px-5 py-3 font-medium text-right">Usuários</th>
                <th className="px-5 py-3 font-medium text-right">Processos</th>
                <th className="px-5 py-3 font-medium text-right">Criado em</th>
                <th className="px-5 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => (
                <motion.tr key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-600/20 border border-violet-500/30 flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-violet-400" />
                      </div>
                      <span className="text-white font-medium">{t.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-400">{t.slug}</td>
                  <td className="px-5 py-3 text-right text-slate-300">{t.userCount}</td>
                  <td className="px-5 py-3 text-right text-slate-300">{t.caseCount}</td>
                  <td className="px-5 py-3 text-right text-slate-400">{new Date(t.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setEditingTenant(t); setForm({ ...defaultForm, name: t.name, slug: t.slug, website: t.website || "", whatsapp: t.whatsapp || "" }); }} className="p-1.5 rounded-lg text-slate-400 hover:text-violet-400 hover:bg-violet-500/10 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(t.id, t.name)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-center py-8 text-slate-500 text-sm">Nenhum escritório encontrado.</p>}
        </div>
      )}

      {showCreate && <CreateModal />}
      {editingTenant && <EditModal />}
    </div>
  );
};

export default AdminTenants;
