import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Search, ChevronDown, ChevronRight, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface UserProfile {
  user_id: string;
  full_name: string;
  phone: string | null;
  cpf: string | null;
  tenant_id: string;
  roles: string[];
  created_at: string;
}

interface TenantGroup {
  id: string;
  name: string;
  staff: UserProfile[];
  clients: UserProfile[];
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
  const [tenantGroups, setTenantGroups] = useState<TenantGroup[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedTenants, setExpandedTenants] = useState<Record<string, boolean>>({});

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

      const users: UserProfile[] = (profilesRes.data || []).map((p) => ({
        ...p,
        roles: roleMap[p.user_id] || [],
      }));

      // Group by tenant
      const grouped: Record<string, { staff: UserProfile[]; clients: UserProfile[] }> = {};
      users.forEach((u) => {
        if (!grouped[u.tenant_id]) grouped[u.tenant_id] = { staff: [], clients: [] };
        const isClient = u.roles.includes("client") && !u.roles.includes("owner") && !u.roles.includes("staff");
        if (isClient) {
          grouped[u.tenant_id].clients.push(u);
        } else {
          grouped[u.tenant_id].staff.push(u);
        }
      });

      const groups: TenantGroup[] = Object.entries(grouped).map(([tid, data]) => ({
        id: tid,
        name: tenantMap[tid] || "—",
        staff: data.staff,
        clients: data.clients,
      })).sort((a, b) => a.name.localeCompare(b.name));

      setTenantGroups(groups);
      setLoading(false);
    };
    fetchData();
  }, []);

  const toggleTenant = (id: string) => {
    setExpandedTenants((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const totalStaff = tenantGroups.reduce((s, g) => s + g.staff.length, 0);

  const filteredGroups = search
    ? tenantGroups
        .map((g) => ({
          ...g,
          staff: g.staff.filter((u) => u.full_name.toLowerCase().includes(search.toLowerCase())),
          clients: g.clients.filter((u) => u.full_name.toLowerCase().includes(search.toLowerCase())),
        }))
        .filter((g) => g.staff.length > 0 || g.clients.length > 0 || g.name.toLowerCase().includes(search.toLowerCase()))
    : tenantGroups;

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white font-display">Usuários por Escritório</h1>
        <p className="text-sm text-slate-400 mt-1">{totalStaff} usuário{totalStaff !== 1 ? "s" : ""} de escritório • {tenantGroups.length} escritório{tenantGroups.length !== 1 ? "s" : ""}</p>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Buscar por nome ou escritório..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-9 pr-4 rounded-lg bg-slate-900/60 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
        />
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Carregando...</p>
      ) : filteredGroups.length === 0 ? (
        <p className="text-center py-8 text-slate-500 text-sm">Nenhum usuário encontrado.</p>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((group, gi) => (
            <motion.div
              key={group.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: gi * 0.05 }}
              className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden backdrop-blur"
            >
              {/* Tenant header - always visible with staff */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-violet-400" />
                    <h3 className="text-white font-semibold">{group.name}</h3>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>{group.staff.length} equipe</span>
                    <span>{group.clients.length} cliente{group.clients.length !== 1 ? "s" : ""}</span>
                  </div>
                </div>

                {/* Staff always visible */}
                {group.staff.length > 0 && (
                  <div className="space-y-1.5">
                    {group.staff.map((u) => (
                      <div key={u.user_id} className="flex items-center justify-between bg-slate-800/40 rounded-md px-3 py-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center text-[10px] font-bold text-white">
                            {u.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                          </div>
                          <div>
                            <p className="text-sm text-white font-medium">{u.full_name}</p>
                            {u.phone && <p className="text-[10px] text-slate-500">{u.phone}</p>}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {u.roles.map((r) => (
                            <span key={r} className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${roleBadge[r] || "bg-slate-700 text-slate-300 border-slate-600"}`}>
                              {roleLabel[r] || r}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Clients expandable */}
              {group.clients.length > 0 && (
                <>
                  <button
                    onClick={() => toggleTenant(group.id)}
                    className="w-full flex items-center justify-between px-4 py-2.5 border-t border-slate-800 hover:bg-slate-800/30 transition-colors text-xs text-slate-400"
                  >
                    <span>Clientes ({group.clients.length})</span>
                    {expandedTenants[group.id] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>

                  {expandedTenants[group.id] && (
                    <div className="px-4 pb-3 space-y-1">
                      {group.clients.map((u) => (
                        <div key={u.user_id} className="flex items-center justify-between bg-slate-800/30 rounded-md px-3 py-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-full bg-slate-700/60 flex items-center justify-center text-[9px] font-bold text-slate-300">
                              {u.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                            </div>
                            <p className="text-sm text-slate-300">{u.full_name}</p>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${roleBadge.client}`}>
                            Cliente
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
