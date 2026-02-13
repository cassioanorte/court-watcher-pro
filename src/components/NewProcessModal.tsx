import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { X } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type ProcessSource = Database["public"]["Enums"]["process_source"];

const sourceOptions: { value: ProcessSource; label: string }[] = [
  { value: "TJRS_1G", label: "TJRS - 1º Grau" },
  { value: "TJRS_2G", label: "TJRS - 2º Grau" },
  { value: "TRF4_JFRS", label: "TRF4 - JFRS" },
  { value: "TRF4_JFSC", label: "TRF4 - JFSC" },
  { value: "TRF4_JFPR", label: "TRF4 - JFPR" },
  { value: "TST" as ProcessSource, label: "TST - Tribunal Superior do Trabalho" },
  { value: "TSE" as ProcessSource, label: "TSE - Tribunal Superior Eleitoral" },
  { value: "STJ" as ProcessSource, label: "STJ - Superior Tribunal de Justiça" },
  { value: "STM" as ProcessSource, label: "STM - Superior Tribunal Militar" },
  { value: "TRF1" as ProcessSource, label: "TRF1 - 1ª Região" },
  { value: "TRF2" as ProcessSource, label: "TRF2 - 2ª Região" },
  { value: "TRF3" as ProcessSource, label: "TRF3 - 3ª Região" },
  { value: "TRF4" as ProcessSource, label: "TRF4 - 4ª Região" },
  { value: "TRF5" as ProcessSource, label: "TRF5 - 5ª Região" },
  { value: "TRF6" as ProcessSource, label: "TRF6 - 6ª Região" },
  { value: "TRT1" as ProcessSource, label: "TRT1 - 1ª Região" },
  { value: "TRT2" as ProcessSource, label: "TRT2 - 2ª Região" },
  { value: "TRT3" as ProcessSource, label: "TRT3 - 3ª Região" },
  { value: "TRT4" as ProcessSource, label: "TRT4 - 4ª Região" },
  { value: "TRT5" as ProcessSource, label: "TRT5 - 5ª Região" },
  { value: "TRT6" as ProcessSource, label: "TRT6 - 6ª Região" },
  { value: "TRT7" as ProcessSource, label: "TRT7 - 7ª Região" },
  { value: "TRT8" as ProcessSource, label: "TRT8 - 8ª Região" },
  { value: "TRT9" as ProcessSource, label: "TRT9 - 9ª Região" },
  { value: "TRT10" as ProcessSource, label: "TRT10 - 10ª Região" },
  { value: "TRT11" as ProcessSource, label: "TRT11 - 11ª Região" },
  { value: "TRT12" as ProcessSource, label: "TRT12 - 12ª Região" },
  { value: "TRT13" as ProcessSource, label: "TRT13 - 13ª Região" },
  { value: "TRT14" as ProcessSource, label: "TRT14 - 14ª Região" },
  { value: "TRT15" as ProcessSource, label: "TRT15 - 15ª Região" },
  { value: "TRT16" as ProcessSource, label: "TRT16 - 16ª Região" },
  { value: "TRT17" as ProcessSource, label: "TRT17 - 17ª Região" },
  { value: "TRT18" as ProcessSource, label: "TRT18 - 18ª Região" },
  { value: "TRT19" as ProcessSource, label: "TRT19 - 19ª Região" },
  { value: "TRT20" as ProcessSource, label: "TRT20 - 20ª Região" },
  { value: "TRT21" as ProcessSource, label: "TRT21 - 21ª Região" },
  { value: "TRT22" as ProcessSource, label: "TRT22 - 22ª Região" },
  { value: "TRT23" as ProcessSource, label: "TRT23 - 23ª Região" },
  { value: "TRT24" as ProcessSource, label: "TRT24 - 24ª Região" },
];

interface NewProcessModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultClientUserId?: string;
}

const NewProcessModal = ({ open, onClose, onSuccess, defaultClientUserId }: NewProcessModalProps) => {
  const [processNumber, setProcessNumber] = useState("");
  const [source, setSource] = useState<ProcessSource>("TJRS_1G");
  const [subject, setSubject] = useState("");
  const [caseSummary, setCaseSummary] = useState("");
  const [clientUserId, setClientUserId] = useState(defaultClientUserId || "");
  const [automationEnabled, setAutomationEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<{ user_id: string; full_name: string }[]>([]);
  const { tenantId, user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (open && defaultClientUserId) {
      setClientUserId(defaultClientUserId);
    }
  }, [open, defaultClientUserId]);

  useEffect(() => {
    if (!open || !tenantId) return;
    const fetchClients = async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("tenant_id", tenantId);
      if (!profiles) return;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", profiles.map((p) => p.user_id));

      const clientIds = new Set((roles || []).filter((r) => r.role === "client").map((r) => r.user_id));
      setClients(profiles.filter((p) => clientIds.has(p.user_id)));
    };
    fetchClients();
  }, [open, tenantId]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data: inserted, error } = await supabase.from("cases").insert({
        tenant_id: tenantId,
        process_number: processNumber,
        source,
        subject: subject || null,
        case_summary: caseSummary || null,
        client_user_id: clientUserId || null,
        responsible_user_id: user?.id || null,
        automation_enabled: automationEnabled,
      }).select("id").single();
      if (error) throw error;
      toast({ title: "Processo cadastrado!", description: processNumber });

      // Auto-fetch movements after creation
      if (inserted?.id) {
        supabase.functions.invoke("fetch-movements", {
          body: { case_id: inserted.id },
        }).catch(err => console.error("Auto-fetch movements failed:", err));
      }

      setProcessNumber("");
      setSubject("");
      setCaseSummary("");
      setClientUserId("");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-foreground/30" onClick={onClose} />
      <div className="relative bg-card rounded-xl border shadow-lg w-full max-w-md p-6 animate-scale-in">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>

        <h2 className="text-lg font-bold text-foreground mb-1">Novo Processo</h2>
        <p className="text-sm text-muted-foreground mb-5">Cadastre um processo para acompanhamento</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Número CNJ *</label>
            <input type="text" value={processNumber} onChange={(e) => setProcessNumber(e.target.value)} required placeholder="0000000-00.0000.0.00.0000" className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Origem *</label>
            <select value={source} onChange={(e) => setSource(e.target.value as ProcessSource)} className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40">
              {sourceOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Assunto</label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex: Indenização por danos morais" className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Resumo do caso</label>
            <textarea value={caseSummary} onChange={(e) => setCaseSummary(e.target.value)} placeholder="Descreva brevemente o caso, partes envolvidas, pedidos, etc." rows={3} className="w-full mt-1 px-3 py-2 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cliente</label>
            <select value={clientUserId} onChange={(e) => setClientUserId(e.target.value)} className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40">
              <option value="">Sem cliente vinculado</option>
              {clients.map((c) => <option key={c.user_id} value={c.user_id}>{c.full_name}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={automationEnabled} onChange={(e) => setAutomationEnabled(e.target.checked)} className="rounded border-border" />
            <span className="text-sm text-foreground">Ativar captura automática de movimentações</span>
          </label>
          <button type="submit" disabled={loading} className="w-full h-10 rounded-lg gradient-accent text-accent-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
            {loading ? "Cadastrando..." : "Cadastrar processo"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default NewProcessModal;
