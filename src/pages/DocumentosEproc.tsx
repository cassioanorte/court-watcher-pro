import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Circle, FileText, DollarSign, Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DocItem {
  name: string;
  url: string;
  event_number: string;
  doc_type: "rpv" | "precatorio" | "alvara" | "outro";
  fee_type?: "contratuais" | "sucumbencia";
}

interface PayloadData {
  docs: DocItem[];
  process_number: string;
  tenant_id: string;
  source_url: string;
}

const TYPE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  rpv: { label: "RPV", color: "text-green-600 bg-green-100", icon: "💰" },
  precatorio: { label: "Precatório", color: "text-blue-600 bg-blue-100", icon: "💰" },
  alvara: { label: "Alvará", color: "text-amber-600 bg-amber-100", icon: "📜" },
  outro: { label: "Documento", color: "text-gray-600 bg-gray-100", icon: "📄" },
};

const DocumentosEproc = () => {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [data, setData] = useState<PayloadData | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timeoutId: number | null = null;
    let readyPingIntervalId: number | null = null;

    const clearPendingListeners = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (readyPingIntervalId) {
        window.clearInterval(readyPingIntervalId);
        readyPingIntervalId = null;
      }
      window.removeEventListener("message", handleMessage);
    };

    const applyParsed = (parsed: PayloadData | null) => {
      if (!parsed || !Array.isArray(parsed.docs) || parsed.docs.length === 0) return false;

      setData(parsed);
      setError(null);

      const autoSelect = new Set<number>();
      parsed.docs.forEach((d, i) => {
        if (d.doc_type !== "outro") autoSelect.add(i);
      });
      setSelected(autoSelect);
      return true;
    };

    const parseUnknownPayload = (value: unknown): PayloadData | null => {
      if (!value) return null;
      if (typeof value === "string") {
        try {
          return JSON.parse(value) as PayloadData;
        } catch {
          return null;
        }
      }
      if (typeof value === "object") return value as PayloadData;
      return null;
    };

    const handleMessage = (event: MessageEvent) => {
      const payload = parseUnknownPayload((event.data as any)?.payload);
      const type = (event.data as any)?.type;
      if (type !== "lex_doc_capture_payload") return;

      if (applyParsed(payload)) {
        clearPendingListeners();
      }
    };

    try {
      let parsed: PayloadData | null = null;

      // 1) window.name from popup (cross-domain safe)
      const popupName = window.name || "";
      if (popupName.startsWith("lex_doc_capture:")) {
        const encoded = popupName.replace("lex_doc_capture:", "");
        const decoded = decodeURIComponent(escape(atob(encoded)));
        parsed = JSON.parse(decoded) as PayloadData;
        window.name = "";
      } else if (popupName.startsWith("lex_doc_capture_raw:")) {
        const rawPayload = popupName.replace("lex_doc_capture_raw:", "");
        parsed = JSON.parse(rawPayload) as PayloadData;
        window.name = "";
      }

      // 2) localStorage fallback (same-origin flows)
      if (!parsed) {
        const stored = localStorage.getItem("lex_doc_capture");
        if (stored) {
          parsed = JSON.parse(stored) as PayloadData;
          localStorage.removeItem("lex_doc_capture");
        }
      }

      // 3) URL fallback (legacy bookmarklet)
      if (!parsed) {
        const raw = searchParams.get("data");
        if (raw) {
          parsed = JSON.parse(decodeURIComponent(raw)) as PayloadData;
        }
      }

      if (applyParsed(parsed)) return;

      // 4) postMessage channel (robust fallback for browsers that clear window.name)
      window.addEventListener("message", handleMessage);

      const sendReadySignal = () => {
        try {
          window.opener?.postMessage({ type: "lex_doc_capture_ready" }, "*");
        } catch {
          // no-op
        }
      };

      sendReadySignal();
      readyPingIntervalId = window.setInterval(sendReadySignal, 500);

      timeoutId = window.setTimeout(() => {
        setError("Nenhum dado recebido. Execute o bookmarklet novamente na página do processo.");
        clearPendingListeners();
      }, 15000);
    } catch {
      setError("Erro ao processar dados. Tente usar o bookmarklet novamente.");
      clearPendingListeners();
    }

    return () => {
      clearPendingListeners();
    };
  }, [searchParams]);

  const financialDocs = useMemo(() => 
    data?.docs.filter(d => d.doc_type !== "outro") || [], [data]);

  const toggle = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const selectAll = () => {
    if (!data) return;
    if (selected.size === data.docs.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.docs.map((_, i) => i)));
    }
  };

  const selectFinancial = () => {
    if (!data) return;
    const fin = new Set<number>();
    data.docs.forEach((d, i) => { if (d.doc_type !== "outro") fin.add(i); });
    setSelected(fin);
  };

  const handleProcess = async () => {
    if (!data || selected.size === 0) return;
    setProcessing(true);
    try {
      const selectedDocs = data.docs.filter((_, i) => selected.has(i));
      const { data: res, error: err } = await supabase.functions.invoke("capture-documents", {
        body: {
          documents: selectedDocs,
          process_number: data.process_number,
          tenant_id: data.tenant_id,
          source_url: data.source_url,
        },
      });
      if (err) throw err;
      setResult(res);
      toast({ title: "Documentos processados!", description: `${res.documents_saved || 0} novos, ${res.documents_skipped || 0} já existentes, ${res.payment_orders_created || 0} lançamentos financeiros.` });
    } catch (e: any) {
      setError(e.message || "Erro ao processar");
    } finally {
      setProcessing(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md mx-auto text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
          <h1 className="text-lg font-bold text-foreground">Erro</h1>
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md mx-auto text-center space-y-4">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
          <h1 className="text-xl font-bold text-foreground">Processamento Concluído!</h1>
          <div className="bg-card rounded-lg border p-4 space-y-2 text-sm text-left">
            <p><strong>Processo:</strong> {data?.process_number}</p>
            <p><strong>Documentos novos salvos:</strong> {result.documents_saved || 0}</p>
            <p><strong>Já existentes (ignorados):</strong> {result.documents_skipped || 0}</p>
            {(result.payment_orders_created || 0) > 0 && (
              <p className="text-green-600 font-medium">
                💰 {result.payment_orders_created} lançamento(s) financeiro(s) criado(s) — pendente(s) de conferência
              </p>
            )}
            {(result.payment_orders_skipped || 0) > 0 && (
              <p className="text-muted-foreground">
                {result.payment_orders_skipped} lançamento(s) financeiro(s) já existente(s)
              </p>
            )}
          </div>
          <button
            onClick={() => window.close()}
            className="px-6 py-2.5 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:opacity-90"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="text-center space-y-1">
          <h1 className="text-lg font-bold text-foreground">📄 Documentos do Processo</h1>
          <p className="text-sm text-muted-foreground">{data.process_number}</p>
          <p className="text-xs text-muted-foreground">{data.docs.length} documento(s) encontrado(s)</p>
        </div>

        {financialDocs.length > 0 && (
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
            <p className="text-sm text-green-700 dark:text-green-300 font-medium flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              {financialDocs.length} documento(s) financeiro(s) detectado(s) — serão lançados automaticamente para conferência
            </p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button onClick={selectAll} className="text-xs px-3 py-1.5 rounded border hover:bg-muted transition-colors">
            {selected.size === data.docs.length ? "Desmarcar todos" : "Selecionar todos"}
          </button>
          {financialDocs.length > 0 && financialDocs.length < data.docs.length && (
            <button onClick={selectFinancial} className="text-xs px-3 py-1.5 rounded border hover:bg-muted transition-colors">
              Apenas financeiros
            </button>
          )}
          <span className="text-xs text-muted-foreground ml-auto">{selected.size} selecionado(s)</span>
        </div>

        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {data.docs.map((doc, idx) => {
            const info = TYPE_LABELS[doc.doc_type];
            const isSelected = selected.has(idx);
            return (
              <button
                key={idx}
                onClick={() => toggle(idx)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                  isSelected ? "bg-accent/10 border-accent" : "bg-card hover:bg-muted/50"
                }`}
              >
                {isSelected ? (
                  <CheckCircle className="w-5 h-5 text-accent shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground/40 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {doc.event_number && <span className="text-muted-foreground">Evento {doc.event_number} — </span>}
                    {doc.name}
                  </p>
                  {doc.fee_type === "sucumbencia" && (
                    <span className="text-xs text-muted-foreground">Sucumbência</span>
                  )}
                </div>
                <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${info.color}`}>
                  {info.icon} {info.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => window.close()}
            className="flex-1 px-4 py-2.5 rounded-lg border text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleProcess}
            disabled={selected.size === 0 || processing}
            className="flex-1 px-4 py-2.5 rounded-lg bg-accent text-accent-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {processing ? "Processando..." : `Processar ${selected.size} documento(s)`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentosEproc;
