import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Search, Users, Phone, Mail, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import NewContactModal from "@/components/NewContactModal";

type ContactProfile = {
  user_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
};

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const Contatos = () => {
  const [contacts, setContacts] = useState<ContactProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [letterFilter, setLetterFilter] = useState("");
  const [showNewModal, setShowNewModal] = useState(false);
  const { tenantId } = useAuth();

  const loadContacts = useCallback(async () => {
    if (!tenantId) return;
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, phone, email, created_at")
      .eq("tenant_id", tenantId);

    if (profiles && profiles.length > 0) {
      const userIds = profiles.map((p) => p.user_id);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      const clientIds = new Set(
        (roles || []).filter((r) => r.role === "client").map((r) => r.user_id)
      );
      setContacts(
        profiles
          .filter((p) => clientIds.has(p.user_id))
          .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"))
      );
    } else {
      setContacts([]);
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const filtered = contacts.filter((c) => {
    const matchesSearch = c.full_name.toLowerCase().includes(search.toLowerCase());
    const matchesLetter = !letterFilter || c.full_name.toUpperCase().startsWith(letterFilter);
    return matchesSearch && matchesLetter;
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Contatos</h1>
        <button
          onClick={() => setShowNewModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" /> Novo Contato
        </button>
      </div>

      <NewContactModal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreated={loadContacts}
      />

      {/* Alphabet filter */}
      <div className="flex items-center gap-0.5 flex-wrap bg-card border rounded-lg p-2">
        <button
          onClick={() => setLetterFilter("")}
          className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
            !letterFilter ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          TODOS
        </button>
        {ALPHABET.map((l) => (
          <button
            key={l}
            onClick={() => setLetterFilter(l === letterFilter ? "" : l)}
            className={`px-1.5 py-1 rounded text-xs font-medium transition-colors ${
              letterFilter === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {l}
          </button>
        ))}
        <div className="flex-1 min-w-[200px] ml-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Procure por nome, apelido ou nome fantasia do seu contato"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-4 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground">
        Mostrando {filtered.length} de {contacts.length} contato(s)
      </p>

      {/* Table */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="bg-card border rounded-lg overflow-hidden shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="px-4 py-3 font-medium w-12">TIPO</th>
                <th className="px-4 py-3 font-medium">NOME</th>
                <th className="px-4 py-3 font-medium">TELEFONE</th>
                <th className="px-4 py-3 font-medium">EMAIL</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    Nenhum contato encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((c, i) => (
                  <motion.tr
                    key={c.user_id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Users className="w-4 h-4 text-muted-foreground" />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/contatos/${c.user_id}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {c.full_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.phone ? (
                        <span className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3" /> {c.phone}
                        </span>
                      ) : (
                        <span className="italic text-muted-foreground/60">Nenhum telefone</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.email ? (
                        <span className="flex items-center gap-1.5">
                          <Mail className="w-3 h-3" /> {c.email}
                        </span>
                      ) : (
                        <span className="italic text-muted-foreground/60">Nenhum email</span>
                      )}
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Contatos;
