import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface LogEntry {
  id: string;
  action: string;
  details: any;
  user_id: string | null;
  tenant_id: string;
  created_at: string;
  userName: string;
  tenantName: string;
}

const AdminActivity = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [logsRes, profilesRes, tenantsRes] = await Promise.all([
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("profiles").select("user_id, full_name"),
        supabase.from("tenants").select("id, name"),
      ]);

      const nameMap: Record<string, string> = {};
      (profilesRes.data || []).forEach((p) => { nameMap[p.user_id] = p.full_name; });
      const tenantMap: Record<string, string> = {};
      (tenantsRes.data || []).forEach((t) => { tenantMap[t.id] = t.name; });

      setLogs(
        (logsRes.data || []).map((l) => ({
          ...l,
          userName: l.user_id ? nameMap[l.user_id] || "Desconhecido" : "Sistema",
          tenantName: tenantMap[l.tenant_id] || "—",
        }))
      );
      setLoading(false);
    };
    fetchData();
  }, []);

  const filtered = logs.filter(
    (l) =>
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.userName.toLowerCase().includes(search.toLowerCase()) ||
      l.tenantName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white font-display">Atividade</h1>
        <p className="text-sm text-slate-400 mt-1">Histórico de ações do sistema</p>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input type="text" placeholder="Buscar por ação, usuário ou escritório..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-10 pl-9 pr-4 rounded-lg bg-slate-900/60 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40" />
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-8 text-center">
          <Activity className="w-8 h-8 mx-auto text-slate-600 mb-2" />
          <p className="text-sm text-slate-400">Nenhum log de atividade encontrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((log, i) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
              className="bg-slate-900/60 border border-slate-800 rounded-lg px-5 py-3 flex items-center gap-4 backdrop-blur"
            >
              <div className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate">{log.action}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {log.userName} • {log.tenantName}
                </p>
              </div>
              <span className="text-xs text-slate-500 shrink-0">
                {new Date(log.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminActivity;
