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
  const [form, setForm] = useState({ name: "", slug: "", website: "", whatsapp: "" });
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

  const handleCreate = async () => {
    if (!form.name || !form.slug) return;
    const { error } = await supabase.from("tenants").insert({
      name: form.name,
      slug: form.slug.toLowerCase().replace(/[^a-z0-9-]/g, ""),
      website: form.website || null,
      whatsapp: form.whatsapp || null,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Escritório criado!" });
      setShowCreate(false);
      setForm({ name: "", slug: "", website: "", whatsapp: "" });
      fetchTenants();
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

  const FormModal = ({ title, onSubmit, onClose }: { title: string; onSubmit: () => void; onClose: () => void }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 uppercase">Nome</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full mt-1 h-9 px-3 rounded-lg bg-slate-800 border border-slate-600 text-sm text-white focus:ring-2 focus:ring-violet-500/40 focus:outline-none" />
          </div>
          {showCreate && (
            <div>
              <label className="text-xs text-slate-400 uppercase">Slug</label>
              <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="w-full mt-1 h-9 px-3 rounded-lg bg-slate-800 border border-slate-600 text-sm text-white focus:ring-2 focus:ring-violet-500/40 focus:outline-none" placeholder="meu-escritorio" />
            </div>
          )}
          <div>
            <label className="text-xs text-slate-400 uppercase">Website</label>
            <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="w-full mt-1 h-9 px-3 rounded-lg bg-slate-800 border border-slate-600 text-sm text-white focus:ring-2 focus:ring-violet-500/40 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase">WhatsApp</label>
            <input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className="w-full mt-1 h-9 px-3 rounded-lg bg-slate-800 border border-slate-600 text-sm text-white focus:ring-2 focus:ring-violet-500/40 focus:outline-none" />
          </div>
        </div>
        <button onClick={onSubmit} className="w-full mt-4 h-9 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity">
          {showCreate ? "Criar" : "Salvar"}
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
        <button onClick={() => { setShowCreate(true); setForm({ name: "", slug: "", website: "", whatsapp: "" }); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 text-white text-sm font-semibold shadow-lg shadow-violet-500/25 hover:opacity-90 transition-opacity">
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
                      <button onClick={() => { setEditingTenant(t); setForm({ name: t.name, slug: t.slug, website: t.website || "", whatsapp: t.whatsapp || "" }); }} className="p-1.5 rounded-lg text-slate-400 hover:text-violet-400 hover:bg-violet-500/10 transition-colors">
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

      {showCreate && <FormModal title="Novo Escritório" onSubmit={handleCreate} onClose={() => setShowCreate(false)} />}
      {editingTenant && <FormModal title="Editar Escritório" onSubmit={handleUpdate} onClose={() => setEditingTenant(null)} />}
    </div>
  );
};

export default AdminTenants;
