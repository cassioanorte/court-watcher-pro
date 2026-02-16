import { useState, useEffect } from "react";
import { Users, UserCheck, X, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

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
  // New format uses " | " separator
  return summary.split(/\s*\|\s*/).map(p => p.trim()).filter(p => p.length > 3);
}

const ImportReview = ({ onUpdate }: { onUpdate?: () => void }) => {
  const { tenantId } = useAuth();
  const { toast } = useToast();
  const [cases, setCases] = useState<ProcessWithParties[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkingCase, setLinkingCase] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [clientsCache, setClientsCache] = useState<Map<string, string>>(new Map());

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

    // Build clients name cache
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .eq("tenant_id", tenantId)
      .eq("contact_type", "Cliente");
    const cache = new Map<string, string>();
    (profiles || []).forEach(p => cache.set(p.full_name.toLowerCase().trim(), p.user_id));
    setClientsCache(cache);
  };

  useEffect(() => {
    fetchPending();
  }, [tenantId]);

  const handleSelectParty = async (caseItem: ProcessWithParties, partyName: string) => {
    setLinkingCase(caseItem.id);
    try {
      // Check cache for existing contact
      const existingUserId = clientsCache.get(partyName.toLowerCase().trim());
      let userId: string;

      if (existingUserId) {
        userId = existingUserId;
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

        // Set default password
        await supabase.functions.invoke("update-client-password", {
          body: { userId, newPassword: "123456" },
        });

        // Update cache
        setClientsCache(prev => new Map(prev).set(partyName.toLowerCase().trim(), userId));
      }

      // Link client to case
      const { error: updateErr } = await supabase
        .from("cases")
        .update({ client_user_id: userId })
        .eq("id", caseItem.id);

      if (updateErr) throw updateErr;

      toast({
        title: "✅ Cliente vinculado!",
        description: `${partyName} → ${caseItem.process_number}`,
      });

      setCases(prev => prev.filter(c => c.id !== caseItem.id));
      onUpdate?.();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLinkingCase(null);
    }
  };

  const handleSkip = async (caseId: string) => {
    await supabase.from("cases").update({ simple_status: "Cadastrado" }).eq("id", caseId);
    setCases(prev => prev.filter(c => c.id !== caseId));
    onUpdate?.();
  };

  if (loading || cases.length === 0) return null;

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
              Revisão de Importação — {cases.length} processo{cases.length !== 1 ? "s" : ""} pendente{cases.length !== 1 ? "s" : ""}
            </h3>
            <p className="text-xs text-muted-foreground">
              Clique no nome da parte que você representa para vincular como cliente
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-[220px]">Processo</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Partes — clique na que você representa</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-[80px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cases.map(c => (
                <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-xs font-mono text-foreground">{c.process_number}</p>
                    {c.subject && <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">{c.subject}</p>}
                  </td>
                  <td className="px-4 py-3">
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
                          {party}
                        </button>
                      ))}
                      {c.parties.length === 0 && (
                        <span className="text-xs text-muted-foreground italic">Partes não identificadas</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleSkip(c.id)}
                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title="Pular — marcar como revisado sem vincular cliente"
                    >
                      <X className="w-3 h-3" /> Pular
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ImportReview;
