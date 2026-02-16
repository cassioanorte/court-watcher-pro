import { useState, useEffect } from "react";
import { Users, UserCheck, X, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

interface ProcessWithParties {
  id: string;
  process_number: string;
  case_summary: string | null;
  client_user_id: string | null;
  subject: string | null;
  parties: string[];
}

function extractPartiesFromSummary(summary: string | null): string[] {
  if (!summary) return [];
  const match = summary.match(/^Partes:\s*(.+)$/i);
  if (!match) return [];
  return match[1].split(/\s+x\s+/i).map(p => p.trim()).filter(p => p.length > 0);
}

const ImportReview = ({ onUpdate }: { onUpdate?: () => void }) => {
  const { tenantId } = useAuth();
  const { toast } = useToast();
  const [cases, setCases] = useState<ProcessWithParties[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkingCase, setLinkingCase] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [clients, setClients] = useState<{ user_id: string; full_name: string }[]>([]);

  const fetchPending = async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from("cases")
      .select("id, process_number, case_summary, client_user_id, subject")
      .eq("tenant_id", tenantId)
      .eq("simple_status", "Importado")
      .is("client_user_id", null)
      .not("case_summary", "is", null)
      .order("created_at", { ascending: false });

    const processed = (data || [])
      .map(c => ({
        ...c,
        parties: extractPartiesFromSummary(c.case_summary),
      }))
      .filter(c => c.parties.length > 0);

    setCases(processed);
    setLoading(false);
  };

  const fetchClients = async () => {
    if (!tenantId) return;
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .eq("tenant_id", tenantId)
      .eq("contact_type", "Cliente");
    setClients(profiles || []);
  };

  useEffect(() => {
    fetchPending();
    fetchClients();
  }, [tenantId]);

  const handleSelectParty = async (caseItem: ProcessWithParties, partyName: string) => {
    setLinkingCase(caseItem.id);
    try {
      // Check if contact already exists by name
      const existing = clients.find(
        c => c.full_name.toLowerCase().trim() === partyName.toLowerCase().trim()
      );

      let userId: string;

      if (existing) {
        userId = existing.user_id;
      } else {
        // Create contact via invite-client
        const fakeEmail = `importado_${crypto.randomUUID().slice(0, 8)}@importado.local`;
        const { data, error } = await supabase.functions.invoke("invite-client", {
          body: {
            email: fakeEmail,
            fullName: partyName,
            role: "client",
            origin: "Importação em Massa",
          },
        });

        if (error || !data?.success) {
          throw new Error(data?.error || error?.message || "Erro ao criar contato");
        }

        userId = data.userId;

        // Update password so the account is usable later
        await supabase.functions.invoke("update-client-password", {
          body: { userId, newPassword: crypto.randomUUID().slice(0, 12) },
        });
      }

      // Link client to case
      const { error: updateErr } = await supabase
        .from("cases")
        .update({ client_user_id: userId })
        .eq("id", caseItem.id);

      if (updateErr) throw updateErr;

      toast({ title: "Cliente vinculado!", description: `${partyName} vinculado ao processo ${caseItem.process_number}` });

      // Remove from list
      setCases(prev => prev.filter(c => c.id !== caseItem.id));
      // Refresh clients cache
      if (!existing) {
        setClients(prev => [...prev, { user_id: userId, full_name: partyName }]);
      }
      onUpdate?.();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLinkingCase(null);
    }
  };

  const handleSkip = async (caseId: string) => {
    // Mark as reviewed by clearing the "Importado" status
    await supabase.from("cases").update({ simple_status: "Cadastrado" }).eq("id", caseId);
    setCases(prev => prev.filter(c => c.id !== caseId));
    onUpdate?.();
  };

  if (loading) return null;
  if (cases.length === 0) return null;

  return (
    <div className="bg-card rounded-lg border shadow-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center">
            <Users className="w-4 h-4 text-accent" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-foreground">
              Revisão de Importação — {cases.length} processo{cases.length !== 1 ? "s" : ""}
            </h3>
            <p className="text-xs text-muted-foreground">
              Clique no nome da parte que você representa para vincular como cliente
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t divide-y max-h-[500px] overflow-y-auto">
          {cases.map((c) => (
            <div key={c.id} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-foreground">{c.process_number}</p>
                {c.subject && <p className="text-[11px] text-muted-foreground truncate">{c.subject}</p>}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {c.parties.map((party, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectParty(c, party)}
                    disabled={linkingCase === c.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium text-foreground hover:border-accent hover:bg-accent/10 hover:text-accent transition-all disabled:opacity-50"
                    title={`Vincular "${party}" como seu cliente`}
                  >
                    {linkingCase === c.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <UserCheck className="w-3 h-3" />
                    )}
                    {party.length > 40 ? party.substring(0, 40) + "…" : party}
                  </button>
                ))}
                <button
                  onClick={() => handleSkip(c.id)}
                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Pular — marcar como revisado sem vincular cliente"
                >
                  <X className="w-3 h-3" /> Pular
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImportReview;
