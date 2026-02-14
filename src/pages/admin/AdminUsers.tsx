import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface UserProfile {
  user_id: string;
  full_name: string;
  phone: string | null;
  cpf: string | null;
  tenant_id: string;
  tenantName: string;
  roles: string[];
  created_at: string;
}

const roleBadge: Record<string, string> = {
  owner: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  staff: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  client: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  superadmin: "bg-rose-500/20 text-rose-300 border-rose-500/30",
};

const roleLabel: Record<string, string> = {
  owner: "Dono",
  staff: "Staff",
  client: "Cliente",
  superadmin: "SuperAdmin",
};

const AdminUsers = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [profilesRes, rolesRes, tenantsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, phone, cpf, tenant_id, created_at"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("tenants").select("id, name"),
      ]);

      const tenantMap: Record<string, string> = {};
      (tenantsRes.data || []).forEach((t) => { tenantMap[t.id] = t.name; });

      const roleMap: Record<string, string[]> = {};
      (rolesRes.data || []).forEach((r) => {
        if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
        roleMap[r.user_id].push(r.role);
      });

      setUsers(
        (profilesRes.data || []).map((p) => ({
          ...p,
          tenantName: tenantMap[p.tenant_id] || "—",
          roles: roleMap[p.user_id] || [],
        }))
      );
      setLoading(false);
    };
    fetchData();
  }, []);

  const filtered = users
    .filter((u) => u.full_name.toLowerCase().includes(search.toLowerCase()) || u.tenantName.toLowerCase().includes(search.toLowerCase()))
    .filter((u) => !filterRole || u.roles.includes(filterRole));

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white font-display">Usuários</h1>
        <p className="text-sm text-slate-400 mt-1">{users.length} usuário{users.length !== 1 ? "s" : ""} no sistema</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="text" placeholder="Buscar por nome ou escritório..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-10 pl-9 pr-4 rounded-lg bg-slate-900/60 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40" />
        </div>
        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="h-10 px-3 rounded-lg bg-slate-900/60 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40">
          <option value="">Todos os roles</option>
          <option value="owner">Dono</option>
          <option value="staff">Staff</option>
          <option value="client">Cliente</option>
          <option value="superadmin">SuperAdmin</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Carregando...</p>
      ) : (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden backdrop-blur">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-800">
                <th className="px-5 py-3 font-medium">Nome</th>
                <th className="px-5 py-3 font-medium">Escritório</th>
                <th className="px-5 py-3 font-medium">Roles</th>
                <th className="px-5 py-3 font-medium">CPF</th>
                <th className="px-5 py-3 font-medium text-right">Criado em</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <motion.tr key={u.user_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center text-xs font-bold text-white">
                        {u.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                      </div>
                      <div>
                        <p className="text-white font-medium">{u.full_name}</p>
                        {u.phone && <p className="text-xs text-slate-500">{u.phone}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-300">{u.tenantName}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {u.roles.map((r) => (
                        <span key={r} className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${roleBadge[r] || "bg-slate-700 text-slate-300 border-slate-600"}`}>
                          {roleLabel[r] || r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-400 font-mono text-xs">{u.cpf || "—"}</td>
                  <td className="px-5 py-3 text-right text-slate-400">{new Date(u.created_at).toLocaleDateString("pt-BR")}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-center py-8 text-slate-500 text-sm">Nenhum usuário encontrado.</p>}
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
