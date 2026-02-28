import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Merge, ArrowRight, Check, Loader2, Search } from "lucide-react";

type ContactProfile = {
  user_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  cpf: string | null;
  contact_type: string | null;
  address: string | null;
  case_count: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onMerged: () => void;
};

const MergeContactsModal = ({ open, onClose, onMerged }: Props) => {
  const [contacts, setContacts] = useState<ContactProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [search, setSearch] = useState("");
  const [primary, setPrimary] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { tenantId } = useAuth();
  const { toast } = useToast();

  const loadContacts = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, phone, email, cpf, contact_type, address")
      .eq("tenant_id", tenantId);

    if (!profiles) { setLoading(false); return; }

    const userIds = profiles.map((p) => p.user_id);
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", userIds);

    const clientIds = new Set(
      (roles || []).filter((r) => r.role === "client").map((r) => r.user_id)
    );

    // Count cases per client
    const { data: cases } = await supabase
      .from("cases")
      .select("client_user_id")
      .eq("tenant_id", tenantId);

    const caseCounts: Record<string, number> = {};
    (cases || []).forEach((c) => {
      if (c.client_user_id) {
        caseCounts[c.client_user_id] = (caseCounts[c.client_user_id] || 0) + 1;
      }
    });

    setContacts(
      profiles
        .filter((p) => clientIds.has(p.user_id))
        .map((p) => ({ ...p, case_count: caseCounts[p.user_id] || 0 }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"))
    );
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    if (open) {
      loadContacts();
      setPrimary(null);
      setSelected(new Set());
      setSearch("");
    }
  }, [open, loadContacts]);

  const toggleSelect = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
        if (primary === userId) setPrimary(null);
      } else {
        next.add(userId);
        if (!primary) setPrimary(userId);
      }
      return next;
    });
  };

  const handleMerge = async () => {
    if (!primary || selected.size < 2) return;

    const duplicates = Array.from(selected).filter((id) => id !== primary);
    setMerging(true);

    try {
      // Get primary profile and all duplicate profiles to merge data
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", Array.from(selected));

      const primaryProfile = allProfiles?.find((p) => p.user_id === primary);
      if (!primaryProfile) throw new Error("Perfil principal não encontrado");

      // Merge non-null fields from duplicates into primary
      const mergeFields = [
        "phone", "email", "cpf", "rg", "address", "birth_date", "civil_status",
        "banco", "agencia", "conta_bancaria", "chave_pix", "ctps", "pis",
        "titulo_eleitor", "cnh", "passaporte", "certidao_reservista",
        "atividade_economica", "nome_pai", "nome_mae", "naturalidade",
        "nacionalidade", "comentarios", "avatar_url", "origin"
      ] as const;

      const updates: Record<string, any> = {};
      const dupProfiles = allProfiles?.filter((p) => p.user_id !== primary) || [];

      for (const field of mergeFields) {
        if (!primaryProfile[field]) {
          for (const dup of dupProfiles) {
            if (dup[field]) {
              updates[field] = dup[field];
              break;
            }
          }
        }
      }

      // Update primary profile with merged data
      if (Object.keys(updates).length > 0) {
        // Handle CPF uniqueness - clear from duplicates first
        if (updates.cpf) {
          for (const dup of dupProfiles) {
            if (dup.cpf === updates.cpf) {
              await supabase.from("profiles").update({ cpf: null }).eq("user_id", dup.user_id);
            }
          }
        }
        await supabase.from("profiles").update(updates).eq("user_id", primary);
      }

      // Move all related records from duplicates to primary
      for (const dupId of duplicates) {
        await supabase.from("cases").update({ client_user_id: primary }).eq("client_user_id", dupId);
        await supabase.from("billing_collections").update({ client_user_id: primary }).eq("client_user_id", dupId);
        await supabase.from("financial_transactions").update({ client_user_id: primary }).eq("client_user_id", dupId);
        await supabase.from("appointments").update({ client_user_id: primary }).eq("client_user_id", dupId);
        await supabase.from("client_notifications").update({ client_user_id: primary }).eq("client_user_id", dupId);
        await supabase.from("contact_documents").update({ contact_user_id: primary }).eq("contact_user_id", dupId);

        // Delete duplicate profile and role
        await supabase.from("user_roles").delete().eq("user_id", dupId);
        await supabase.from("profiles").delete().eq("user_id", dupId);
      }

      toast({ title: "Contatos mesclados!", description: `${duplicates.length} contato(s) duplicado(s) removido(s).` });
      onMerged();
      onClose();
    } catch (err: any) {
      toast({ title: "Erro ao mesclar", description: err.message, variant: "destructive" });
    } finally {
      setMerging(false);
    }
  };

  const filtered = contacts.filter((c) =>
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.cpf && c.cpf.includes(search)) ||
    (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
  );

  const primaryContact = contacts.find((c) => c.user_id === primary);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Merge className="w-5 h-5" /> Mesclar Contatos
          </DialogTitle>
          <DialogDescription className="text-sm">
            Selecione 2+ contatos duplicados, escolha o principal (clique no rádio) e mescle.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nome, CPF ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-4 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        <ScrollArea className="max-h-[50vh] px-6">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <div className="space-y-1 pb-4">
              {filtered.map((c) => {
                const isSelected = selected.has(c.user_id);
                const isPrimary = primary === c.user_id;
                return (
                  <div
                    key={c.user_id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-transparent hover:bg-muted/50"
                    }`}
                    onClick={() => toggleSelect(c.user_id)}
                  >
                    {/* Selection checkbox */}
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                    }`}>
                      {isSelected && <Check className="w-3 h-3" />}
                    </div>

                    {/* Primary radio */}
                    {isSelected && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setPrimary(c.user_id); }}
                        className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                          isPrimary ? "border-primary" : "border-muted-foreground/40"
                        }`}
                        title="Definir como principal"
                      >
                        {isPrimary && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </button>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{c.full_name}</span>
                        {isPrimary && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground font-semibold">
                            PRINCIPAL
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {c.cpf && <span>CPF: {c.cpf}</span>}
                        {c.email && <span>{c.email}</span>}
                        {c.phone && <span>{c.phone}</span>}
                        <span>{c.case_count} processo(s)</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Summary & action */}
        <div className="px-6 pb-6 pt-2 border-t space-y-3">
          {selected.size >= 2 && primaryContact && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <span className="font-semibold">{selected.size - 1}</span> contato(s) serão mesclados em{" "}
              <span className="font-semibold text-primary">{primaryContact.full_name}</span>.
              Todos os processos, cobranças e dados serão transferidos.
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={merging}>
              Cancelar
            </Button>
            <Button
              onClick={handleMerge}
              disabled={merging || selected.size < 2 || !primary}
              className="gap-2"
            >
              {merging ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Mesclando...</>
              ) : (
                <><Merge className="w-4 h-4" /> Mesclar Contatos</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MergeContactsModal;
