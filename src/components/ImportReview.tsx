import { useState, useEffect } from "react";
import { Users, UserCheck, X, Trash2, Loader2, ChevronDown, ChevronUp, CheckSquare, Square, MinusSquare, Pencil, Check, ExternalLink, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { getCourtUrl, formatCNJ, openViaBlank } from "@/lib/courtUrls";

interface ProcessWithParties {
  id: string;
  process_number: string;
  source: string | null;
  case_summary: string | null;
  client_user_id: string | null;
  subject: string | null;
  author: string | null;
  defendant: string | null;
}

function extractPartiesFromSummary(summary: string | null): { author: string | null; defendant: string | null } {
  if (!summary) return { author: null, defendant: null };
  const parts = summary.split(/\s*\|\s*/);
  return {
    author: parts[0]?.trim() || null,
    defendant: parts[1]?.trim() || null,
  };
}

const EditablePartyName = ({
  name,
  onSave,
  disabled,
  loading,
  onLink,
}: {
  name: string | null;
  onSave: (newName: string) => void;
  disabled: boolean;
  loading: boolean;
  onLink: (name: string) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name || "");

  // Sync internal value when name prop changes
  useEffect(() => {
    if (!editing) setValue(name || "");
  }, [name, editing]);

  if (!name && !editing) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground italic">—</span>
        <button
          onClick={() => { setValue(""); setEditing(true); }}
          className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          title="Adicionar nome"
        >
          <Pencil className="w-3 h-3" />
        </button>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && value.trim()) {
              onSave(value.trim());
              setEditing(false);
            }
            if (e.key === "Escape") {
              setValue(name || "");
              setEditing(false);
            }
          }}
          className="px-2 py-1 text-xs border rounded-md bg-background text-foreground w-full min-w-[120px] focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          onClick={() => {
            if (value.trim()) {
              onSave(value.trim());
              setEditing(false);
            }
          }}
          className="p-1 rounded hover:bg-accent/10 text-accent transition-colors"
          title="Confirmar"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => { setValue(name || ""); setEditing(false); }}
          className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
          title="Cancelar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onLink(name!)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium text-foreground hover:border-accent hover:bg-accent/10 hover:text-accent transition-all disabled:opacity-50"
        title={`Vincular "${name}" como seu cliente`}
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />}
        {name}
      </button>
      <button
        onClick={() => { setValue(name || ""); setEditing(true); }}
        className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        title="Editar nome"
      >
        <Pencil className="w-3 h-3" />
      </button>
    </div>
  );
};

const ImportReview = ({ onUpdate }: { onUpdate?: () => void }) => {
  const { tenantId } = useAuth();
  const { toast } = useToast();
  const [cases, setCases] = useState<ProcessWithParties[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkingCase, setLinkingCase] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [clientsCache, setClientsCache] = useState<Map<string, string>>(new Map());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const fetchPending = async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from("cases")
      .select("id, process_number, source, case_summary, client_user_id, subject, parties")
      .eq("tenant_id", tenantId)
      .eq("simple_status", "Importado")
      .is("client_user_id", null)
      .order("created_at", { ascending: false });

    const processed = (data || []).map(c => {
      const { author, defendant } = extractPartiesFromSummary((c as any).parties);
      return { ...c, author, defendant };
    });

    setCases(processed);
    setLoading(false);

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

  const copyProcessNumber = async (value: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch {
      // fallback below
    }

    try {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      return copied;
    } catch {
      return false;
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === cases.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(cases.map(c => c.id)));
    }
  };

  const deleteCaseById = async (caseId: string) => {
    await Promise.all([
      supabase.from("documents").delete().eq("case_id", caseId),
      supabase.from("messages").delete().eq("case_id", caseId),
      supabase.from("movements").delete().eq("case_id", caseId),
    ]);
    await supabase.from("cases").delete().eq("id", caseId);
  };

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return;
    const count = selected.size;
    if (!confirm(`Tem certeza que deseja excluir ${count} processo${count !== 1 ? "s" : ""} permanentemente?`)) return;

    setDeleting(true);
    try {
      for (const id of selected) {
        await deleteCaseById(id);
      }
      setCases(prev => prev.filter(c => !selected.has(c.id)));
      setSelected(new Set());
      toast({ title: `${count} processo${count !== 1 ? "s" : ""} excluído${count !== 1 ? "s" : ""}` });
      onUpdate?.();
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const handleSelectParty = async (caseItem: ProcessWithParties, partyName: string) => {
    setLinkingCase(caseItem.id);
    try {
      const existingUserId = clientsCache.get(partyName.toLowerCase().trim());
      let userId: string;

      if (existingUserId) {
        userId = existingUserId;
      } else {
        const fakeEmail = `importado_${crypto.randomUUID().slice(0, 8)}@importado.local`;
        const { data, error } = await supabase.functions.invoke("invite-client", {
          body: { email: fakeEmail, fullName: partyName, role: "client", origin: "Importação em Massa" },
        });
        if (error || !data?.success) throw new Error(data?.error || error?.message || "Erro ao criar contato");
        userId = data.userId;
        await supabase.functions.invoke("update-client-password", { body: { userId, password: "123456" } });
        setClientsCache(prev => new Map(prev).set(partyName.toLowerCase().trim(), userId));
      }

      const { error: updateErr } = await supabase.from("cases").update({ client_user_id: userId }).eq("id", caseItem.id);
      if (updateErr) throw updateErr;

      toast({ title: "✅ Cliente vinculado!", description: `${partyName} → ${caseItem.process_number}` });
      setCases(prev => prev.filter(c => c.id !== caseItem.id));
      setSelected(prev => { const n = new Set(prev); n.delete(caseItem.id); return n; });
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
    setSelected(prev => { const n = new Set(prev); n.delete(caseId); return n; });
    onUpdate?.();
  };

  const handleDelete = async (caseId: string) => {
    if (!confirm("Tem certeza que deseja excluir este processo?")) return;
    try {
      await deleteCaseById(caseId);
      setCases(prev => prev.filter(c => c.id !== caseId));
      setSelected(prev => { const n = new Set(prev); n.delete(caseId); return n; });
      toast({ title: "Processo excluído" });
      onUpdate?.();
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    }
  };

  const updatePartyName = async (caseId: string, field: "author" | "defendant", newName: string) => {
    setCases(prev => prev.map(c => {
      if (c.id !== caseId) return c;
      const updated = { ...c, [field]: newName };
      // Persist to DB
      const newParties = [
        field === "author" ? newName : updated.author,
        field === "defendant" ? newName : updated.defendant,
      ].filter(Boolean).join(" | ");
      supabase.from("cases").update({ parties: newParties }).eq("id", caseId).then();
      return updated;
    }));
  };

  if (loading || cases.length === 0) return null;

  const allSelected = selected.size === cases.length;
  const someSelected = selected.size > 0 && !allSelected;

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
        <div className="border-t">
          {/* Bulk actions bar */}
          {selected.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-destructive/5 border-b">
              <span className="text-xs font-medium text-foreground">
                {selected.size} selecionado{selected.size !== 1 ? "s" : ""}
              </span>
              <button
                onClick={handleDeleteSelected}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                Excluir selecionados
              </button>
            </div>
          )}

          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-2.5 w-[40px]">
                    <button onClick={toggleAll} className="text-muted-foreground hover:text-foreground transition-colors">
                      {allSelected ? <CheckSquare className="w-4 h-4" /> : someSelected ? <MinusSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Processo</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Autor</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Réu</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Assunto</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-[100px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {cases.map(c => (
                  <tr key={c.id} className={`hover:bg-muted/20 transition-colors ${selected.has(c.id) ? "bg-accent/5" : ""}`}>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleSelect(c.id)} className="text-muted-foreground hover:text-foreground transition-colors">
                        {selected.has(c.id) ? <CheckSquare className="w-4 h-4 text-accent" /> : <Square className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-mono text-foreground">{c.process_number}</p>
                        {(() => {
                          const publicUrl = getCourtUrl(c.process_number, c.source ?? undefined);
                          const formatted = formatCNJ(c.process_number);
                          return (
                            <>
                              {publicUrl && (
                                <button
                                   onClick={() => {
                                     openViaBlank(publicUrl, formatted);
                                     toast({
                                       title: "Número copiado!",
                                       description: formatted,
                                     });
                                   }}
                                   className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-accent"
                                   title="Copiar número e abrir consulta pública"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                onClick={async () => {
                                  const copied = await copyProcessNumber(formatted);
                                  toast({
                                    title: copied ? "Número copiado!" : "Não foi possível copiar automaticamente",
                                    description: formatted,
                                    variant: copied ? "default" : "destructive",
                                  });
                                }}
                                className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-accent"
                                title="Copiar número formatado (para colar no eproc)"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <EditablePartyName
                        name={c.author}
                        onSave={(newName) => updatePartyName(c.id, "author", newName)}
                        disabled={linkingCase === c.id}
                        loading={linkingCase === c.id}
                        onLink={(name) => handleSelectParty(c, name)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <EditablePartyName
                        name={c.defendant}
                        onSave={(newName) => updatePartyName(c.id, "defendant", newName)}
                        disabled={linkingCase === c.id}
                        loading={linkingCase === c.id}
                        onLink={(name) => handleSelectParty(c, name)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-muted-foreground max-w-[250px] truncate" title={c.subject || ""}>
                        {c.subject || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleSkip(c.id)}
                          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="Pular — marcar como revisado sem vincular cliente"
                        >
                          <X className="w-3 h-3" /> Pular
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Excluir processo permanentemente"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportReview;
