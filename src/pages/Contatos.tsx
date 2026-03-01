import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Search, Users, Phone, Mail, Plus, Merge, Trash2, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import NewContactModal from "@/components/NewContactModal";
import MergeContactsModal from "@/components/MergeContactsModal";

type ContactProfile = {
  user_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  contact_type: string | null;
  created_at: string;
};

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// Brazilian mobile numbers: 11 digits (2 DDD + 9 + 8 digits)
const isWhatsAppNumber = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, "");
  // Add country code if missing
  const full = digits.length === 11 ? `55${digits}` : digits;
  // Must be 13 digits (55 + 2 DDD + 9xxxx-xxxx) and 5th digit must be 9
  return full.length === 13 && full[4] === "9";
};

const Contatos = () => {
  const [contacts, setContacts] = useState<ContactProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [letterFilter, setLetterFilter] = useState("");
  const [showNewModal, setShowNewModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { tenantId } = useAuth();
  const { toast } = useToast();

  const handleDeleteContact = async (userId: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir "${name}"?\n\nIsso desvinculará o contato de todos os processos.`)) return;
    setDeletingId(userId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("manage-team-member", {
        body: { action: "delete", target_user_id: userId },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Erro ao excluir");
      setContacts(prev => prev.filter(c => c.user_id !== userId));
      toast({ title: "Contato excluído", description: `${name} foi removido.` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const loadContacts = useCallback(async () => {
    if (!tenantId) return;
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, phone, email, contact_type, created_at")
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMergeModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-input bg-background text-foreground text-sm font-semibold hover:bg-muted transition-colors"
          >
            <Merge className="w-4 h-4" /> Mesclar
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" /> Novo Contato
          </button>
        </div>
      </div>

      <NewContactModal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreated={loadContacts}
      />
      <MergeContactsModal
        open={showMergeModal}
        onClose={() => setShowMergeModal(false)}
        onMerged={loadContacts}
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
                <th className="px-4 py-3 font-medium w-12"></th>
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
                      <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium border border-primary/20">
                        {c.contact_type || "Cliente"}
                      </span>
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
                          {isWhatsAppNumber(c.phone) && (
                            <a
                              href={`https://wa.me/55${c.phone.replace(/\D/g, "").replace(/^55/, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-600 hover:bg-green-700 text-white text-[10px] font-semibold transition-colors shrink-0"
                              title="Enviar WhatsApp"
                            >
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            </a>
                          )}
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
