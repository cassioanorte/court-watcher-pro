import { motion } from "framer-motion";
import { Search, Plus, Mail, Phone } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import InviteClientModal from "@/components/InviteClientModal";

type ClientProfile = {
  user_id: string;
  full_name: string;
  phone: string | null;
  created_at: string;
};

const Clients = () => {
  const [search, setSearch] = useState("");
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const { tenantId } = useAuth();

  const fetchClients = async () => {
    if (!tenantId) return;
    // Get profiles with client role in same tenant
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name, phone, created_at")
      .eq("tenant_id", tenantId);

    // Filter to only clients by checking user_roles
    if (data && data.length > 0) {
      const userIds = data.map((p) => p.user_id);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      const clientUserIds = new Set(
        (roles || []).filter((r) => r.role === "client").map((r) => r.user_id)
      );
      setClients(data.filter((p) => clientUserIds.has(p.user_id)));
    } else {
      setClients([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchClients();
  }, [tenantId]);

  const filtered = clients
    .filter((c) => c.full_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">{clients.length} cliente{clients.length !== 1 ? "s" : ""} cadastrado{clients.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg gradient-accent text-accent-foreground text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" /> Cadastrar Cliente
        </button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-9 pr-4 rounded-lg bg-card border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-lg border p-8 text-center shadow-card">
          <p className="text-sm text-muted-foreground">
            {clients.length === 0 ? "Nenhum cliente cadastrado ainda. Convide seu primeiro cliente!" : "Nenhum resultado encontrado."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((client, i) => (
            <motion.div
              key={client.user_id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="bg-card rounded-lg border p-5 shadow-card hover:shadow-card-hover transition-shadow"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-sm font-bold text-primary-foreground">
                  {client.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{client.full_name}</h3>
                </div>
              </div>
              <div className="space-y-2 text-xs text-muted-foreground">
                {client.phone && <div className="flex items-center gap-2"><Phone className="w-3 h-3" /> {client.phone}</div>}
              </div>
              <div className="mt-4 pt-3 border-t flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Desde {new Date(client.created_at).toLocaleDateString("pt-BR")}</span>
                <Link to={`/clientes/${client.user_id}`} className="text-xs text-accent hover:underline">Ver detalhes</Link>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <InviteClientModal open={showInvite} onClose={() => setShowInvite(false)} onSuccess={fetchClients} />
    </div>
  );
};

export default Clients;
