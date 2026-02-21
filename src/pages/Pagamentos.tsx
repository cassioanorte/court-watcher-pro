import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Banknote, Upload, Trash2, Eye, FileText, Plus, CheckCircle2, Clock, AlertTriangle, X, ExternalLink, Briefcase } from "lucide-react";
import { FileDropZone } from "@/components/ui/file-drop-zone";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";



interface PaymentOrder {
  id: string;
  tenant_id: string;
  case_id: string | null;
  created_by: string;
  type: string;
  status: string;
  gross_amount: number;
  office_fees_percent: number;
  office_amount: number;
  client_amount: number;
  court_costs: number;
  social_security: number;
  income_tax: number;
  document_url: string | null;
  document_name: string | null;
  beneficiary_name: string | null;
  beneficiary_cpf: string | null;
  process_number: string | null;
  court: string | null;
  entity: string | null;
  reference_date: string | null;
  expected_payment_date: string | null;
  ai_extracted: boolean;
  ai_raw_data: any;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface CaseOption {
  id: string;
  process_number: string;
  parties: string | null;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  aguardando: { label: "Aguardando", color: "bg-amber-500/10 text-amber-600 border-amber-500/30", icon: Clock },
  liberado: { label: "Liberado", color: "bg-blue-500/10 text-blue-600 border-blue-500/30", icon: CheckCircle2 },
  sacado: { label: "Sacado", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", icon: CheckCircle2 },
  cancelado: { label: "Cancelado", color: "bg-destructive/10 text-destructive border-destructive/30", icon: AlertTriangle },
};

const Pagamentos = () => {
  const { user, tenantId } = useAuth();
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<PaymentOrder | null>(null);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);

  // Form state
  const [formType, setFormType] = useState("rpv");
  const [formCaseId, setFormCaseId] = useState("");
  const [formGross, setFormGross] = useState("");
  const [formFeePercent, setFormFeePercent] = useState("20");
  const [formOffice, setFormOffice] = useState("");
  const [formClient, setFormClient] = useState("");
  const [formCourtCosts, setFormCourtCosts] = useState("");
  const [formSocSec, setFormSocSec] = useState("");
  const [formTax, setFormTax] = useState("");
  const [formBeneficiary, setFormBeneficiary] = useState("");
  const [formCpf, setFormCpf] = useState("");
  const [formProcessNumber, setFormProcessNumber] = useState("");
  const [formCourt, setFormCourt] = useState("");
  const [formEntity, setFormEntity] = useState("");
  const [formRefDate, setFormRefDate] = useState("");
  const [formExpDate, setFormExpDate] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formDocUrl, setFormDocUrl] = useState("");
  const [formDocName, setFormDocName] = useState("");
  const [formAiExtracted, setFormAiExtracted] = useState(false);
  const [formAiRaw, setFormAiRaw] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from("payment_orders" as any)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    setOrders((data || []) as unknown as PaymentOrder[]);
    setLoading(false);
  }, [tenantId]);

  const fetchCases = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from("cases")
      .select("id, process_number, parties")
      .eq("tenant_id", tenantId)
      .eq("archived", false)
      .order("process_number")
      .limit(200);
    setCases((data || []) as CaseOption[]);
  }, [tenantId]);

  useEffect(() => {
    fetchOrders();
    fetchCases();
  }, [fetchOrders, fetchCases]);

  // Auto-calculate when gross or fee% changes
  useEffect(() => {
    const gross = parseFloat(formGross) || 0;
    const feeP = parseFloat(formFeePercent) || 0;
    const costs = parseFloat(formCourtCosts) || 0;
    const soc = parseFloat(formSocSec) || 0;
    const tax = parseFloat(formTax) || 0;
    const officeCalc = Math.round(gross * feeP / 100 * 100) / 100;
    const clientCalc = Math.round((gross - officeCalc - costs - soc - tax) * 100) / 100;
    setFormOffice(officeCalc > 0 ? officeCalc.toString() : "");
    setFormClient(clientCalc > 0 ? clientCalc.toString() : "");
  }, [formGross, formFeePercent, formCourtCosts, formSocSec, formTax]);

  const handleFileUpload = async (file: File) => {
    if (!tenantId || !user?.id) return;
    setUploading(true);

    const ext = file.name.split(".").pop();
    const path = `${tenantId}/${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage.from("payment-documents").upload(path, file);
    if (uploadErr) {
      toast.error("Erro no upload: " + uploadErr.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("payment-documents").getPublicUrl(path);
    setFormDocUrl(urlData.publicUrl);
    setFormDocName(file.name);
    toast.success("PDF enviado!");

    // Extract text from PDF for AI analysis
    setExtracting(true);
    try {
      // Read the file as text - for PDFs we send the raw bytes and let AI handle it
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      
      // Try to extract text from PDF (basic extraction)
      let pdfText = "";
      const textDecoder = new TextDecoder("latin1");
      const rawStr = textDecoder.decode(bytes);
      
      // Extract text between stream/endstream blocks
      const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
      let match;
      while ((match = streamRegex.exec(rawStr)) !== null) {
        const content = match[1];
        // Extract readable text
        const textParts = content.match(/\(([^)]*)\)/g);
        if (textParts) {
          pdfText += textParts.map(p => p.slice(1, -1)).join(" ") + "\n";
        }
        const tjParts = content.match(/\[(.*?)\]\s*TJ/g);
        if (tjParts) {
          tjParts.forEach(tj => {
            const parts = tj.match(/\(([^)]*)\)/g);
            if (parts) {
              pdfText += parts.map(p => p.slice(1, -1)).join("") + " ";
            }
          });
          pdfText += "\n";
        }
      }

      // Also try to extract readable ASCII from the entire file
      const asciiLines = rawStr.split("\n").filter(line => {
        const readable = line.replace(/[^\x20-\x7E\xC0-\xFF]/g, "").trim();
        return readable.length > 10 && !line.includes("stream") && !line.includes("endobj");
      });
      if (asciiLines.length > 0) {
        pdfText += "\n" + asciiLines.join("\n");
      }

      if (pdfText.trim().length < 30) {
        toast.info("Não foi possível extrair texto do PDF. Preencha os campos manualmente.");
        setExtracting(false);
        setUploading(false);
        return;
      }

      let aiResult: any = null;
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-payment-data`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ text: pdfText.slice(0, 8000), file_name: file.name }),
          }
        );
        const body = await response.json();
        if (!response.ok) {
          const msg = body?.error || `Erro ${response.status}`;
          if (response.status === 402) {
            toast.error("Créditos de IA esgotados. Preencha os campos manualmente ou adicione créditos.");
          } else if (response.status === 429) {
            toast.error("Limite de requisições excedido. Tente novamente em alguns minutos.");
          } else {
            toast.error(msg);
          }
          setExtracting(false);
          setUploading(false);
          return;
        }
        aiResult = body;
      } catch (fetchErr: any) {
        toast.error("Erro de conexão ao extrair dados: " + (fetchErr.message || "Erro desconhecido"));
        setExtracting(false);
        setUploading(false);
        return;
      }

      if (aiResult?.error) {
        toast.error(aiResult.error);
      } else if (aiResult?.data) {
        const d = aiResult.data;
        if (d.type) setFormType(d.type);
        if (d.gross_amount) setFormGross(d.gross_amount.toString());
        if (d.office_fees_percent) setFormFeePercent(d.office_fees_percent.toString());
        if (d.court_costs) setFormCourtCosts(d.court_costs.toString());
        if (d.social_security) setFormSocSec(d.social_security.toString());
        if (d.income_tax) setFormTax(d.income_tax.toString());
        if (d.beneficiary_name) setFormBeneficiary(d.beneficiary_name);
        if (d.beneficiary_cpf) setFormCpf(d.beneficiary_cpf);
        if (d.process_number) setFormProcessNumber(d.process_number);
        if (d.court) setFormCourt(d.court);
        if (d.entity) setFormEntity(d.entity);
        if (d.reference_date) setFormRefDate(d.reference_date);
        if (d.expected_payment_date) setFormExpDate(d.expected_payment_date);
        setFormAiExtracted(true);
        setFormAiRaw(d);

        // Try to auto-match case
        if (d.process_number && cases.length > 0) {
          const cleanNum = d.process_number.replace(/\D/g, "");
          const matchedCase = cases.find(c => c.process_number.replace(/\D/g, "") === cleanNum);
          if (matchedCase) setFormCaseId(matchedCase.id);
        }

        toast.success("Dados extraídos automaticamente!");
      }
    } catch (err) {
      console.error("Extraction error:", err);
      toast.info("Não foi possível extrair dados automaticamente. Preencha manualmente.");
    }
    setExtracting(false);
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (!user?.id || !tenantId) return;
    setSubmitting(true);
    const { error } = await supabase.from("payment_orders" as any).insert({
      tenant_id: tenantId,
      created_by: user.id,
      case_id: formCaseId || null,
      type: formType,
      status: "aguardando",
      gross_amount: parseFloat(formGross) || 0,
      office_fees_percent: parseFloat(formFeePercent) || 0,
      office_amount: parseFloat(formOffice) || 0,
      client_amount: parseFloat(formClient) || 0,
      court_costs: parseFloat(formCourtCosts) || 0,
      social_security: parseFloat(formSocSec) || 0,
      income_tax: parseFloat(formTax) || 0,
      document_url: formDocUrl || null,
      document_name: formDocName || null,
      beneficiary_name: formBeneficiary || null,
      beneficiary_cpf: formCpf || null,
      process_number: formProcessNumber || null,
      court: formCourt || null,
      entity: formEntity || null,
      reference_date: formRefDate || null,
      expected_payment_date: formExpDate || null,
      ai_extracted: formAiExtracted,
      ai_raw_data: formAiRaw,
      notes: formNotes || null,
    });
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Registro criado!");
      resetForm();
      fetchOrders();
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setFormType("rpv");
    setFormCaseId("");
    setFormGross("");
    setFormFeePercent("20");
    setFormOffice("");
    setFormClient("");
    setFormCourtCosts("");
    setFormSocSec("");
    setFormTax("");
    setFormBeneficiary("");
    setFormCpf("");
    setFormProcessNumber("");
    setFormCourt("");
    setFormEntity("");
    setFormRefDate("");
    setFormExpDate("");
    setFormNotes("");
    setFormDocUrl("");
    setFormDocName("");
    setFormAiExtracted(false);
    setFormAiRaw(null);
    setShowNew(false);
  };

  const updateStatus = async (id: string, newStatus: string) => {
    await supabase.from("payment_orders" as any).update({ status: newStatus }).eq("id", id);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status: newStatus } : null);
    toast.success("Status atualizado");
  };

  const deleteOrder = async (id: string) => {
    await supabase.from("payment_orders" as any).delete().eq("id", id);
    setOrders(prev => prev.filter(o => o.id !== id));
    setSelected(null);
    toast.success("Registro excluído");
  };

  const fmt = (v: number) => v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00";

  const totals = orders.filter(o => o.status !== "cancelado").reduce(
    (acc, o) => ({
      gross: acc.gross + (o.gross_amount || 0),
      office: acc.office + (o.office_amount || 0),
      client: acc.client + (o.client_amount || 0),
    }),
    { gross: 0, office: 0, client: 0 }
  );

  const getCasePn = (caseId: string | null) => {
    if (!caseId) return null;
    return cases.find(c => c.id === caseId)?.process_number || null;
  };

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pagamentos Judiciais</h1>
          <p className="text-sm text-muted-foreground mt-1">RPVs e Precatórios aguardando pagamento</p>
        </div>
        <Button onClick={() => setShowNew(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Registro
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground mb-1">Valor Bruto Total</p>
          <p className="text-xl font-bold text-foreground">{fmt(totals.gross)}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground mb-1">Honorários (Escritório)</p>
          <p className="text-xl font-bold text-accent">{fmt(totals.office)}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground mb-1">Valor do Cliente</p>
          <p className="text-xl font-bold text-foreground">{fmt(totals.client)}</p>
        </motion.div>
      </div>

      {/* Orders list */}
      {orders.length === 0 ? (
        <div className="bg-card rounded-xl border p-8 text-center">
          <Banknote className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum registro de pagamento judicial</p>
          <Button variant="outline" className="mt-4 gap-2" onClick={() => setShowNew(true)}>
            <Upload className="w-4 h-4" /> Enviar primeiro PDF
          </Button>
        </div>
      ) : (
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="p-3 font-medium">Tipo</th>
                  <th className="p-3 font-medium">Beneficiário</th>
                  <th className="p-3 font-medium">Processo</th>
                  <th className="p-3 font-medium text-right">Bruto</th>
                  <th className="p-3 font-medium text-right">Escritório</th>
                  <th className="p-3 font-medium text-right">Cliente</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const st = STATUS_MAP[o.status] || STATUS_MAP.aguardando;
                  const StIcon = st.icon;
                  return (
                    <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setSelected(o)}>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs uppercase">{o.type}</Badge>
                      </td>
                      <td className="p-3 text-foreground font-medium">{o.beneficiary_name || "—"}</td>
                      <td className="p-3 text-muted-foreground font-mono text-xs">{o.process_number || getCasePn(o.case_id) || "—"}</td>
                      <td className="p-3 text-right text-foreground">{fmt(o.gross_amount)}</td>
                      <td className="p-3 text-right text-accent font-medium">{fmt(o.office_amount)}</td>
                      <td className="p-3 text-right text-foreground">{fmt(o.client_amount)}</td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${st.color}`}>
                          <StIcon className="w-3 h-3" /> {st.label}
                        </span>
                      </td>
                      <td className="p-3">
                        {o.document_url && <FileText className="w-4 h-4 text-muted-foreground" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Record Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Pagamento Judicial</DialogTitle>
          </DialogHeader>

          {/* PDF Upload */}
          <FileDropZone
            onFile={handleFileUpload}
            accept=".pdf"
            loading={uploading || extracting}
            loadingText={extracting ? "Extraindo dados..." : "Enviando..."}
            label="Arraste o PDF aqui ou clique para selecionar"
            sublabel="Os dados serão preenchidos automaticamente"
            fileName={formDocName}
            onClear={() => { setFormDocUrl(""); setFormDocName(""); }}
          />

          {formAiExtracted && (
            <Badge variant="secondary" className="text-xs gap-1">
              <CheckCircle2 className="w-3 h-3" /> Dados extraídos por IA
            </Badge>
          )}

          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rpv">RPV</SelectItem>
                    <SelectItem value="precatorio">Precatório</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Vincular Processo</label>
                <Select value={formCaseId} onValueChange={setFormCaseId}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {cases.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.process_number}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Beneficiário</label>
                <Input value={formBeneficiary} onChange={e => setFormBeneficiary(e.target.value)} placeholder="Nome" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">CPF</label>
                <Input value={formCpf} onChange={e => setFormCpf(e.target.value)} placeholder="000.000.000-00" />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nº do Processo</label>
              <Input value={formProcessNumber} onChange={e => setFormProcessNumber(e.target.value)} placeholder="0000000-00.0000.0.00.0000" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Vara/Tribunal</label>
                <Input value={formCourt} onChange={e => setFormCourt(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Entidade Devedora</label>
                <Input value={formEntity} onChange={e => setFormEntity(e.target.value)} placeholder="INSS, União..." />
              </div>
            </div>

            <hr className="border-border" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valores</p>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Valor Bruto (R$)</label>
                <Input type="number" step="0.01" value={formGross} onChange={e => setFormGross(e.target.value)} placeholder="0,00" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Honorários (%)</label>
                <Input type="number" step="0.1" value={formFeePercent} onChange={e => setFormFeePercent(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Custas</label>
                <Input type="number" step="0.01" value={formCourtCosts} onChange={e => setFormCourtCosts(e.target.value)} placeholder="0,00" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">INSS</label>
                <Input type="number" step="0.01" value={formSocSec} onChange={e => setFormSocSec(e.target.value)} placeholder="0,00" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">IR</label>
                <Input type="number" step="0.01" value={formTax} onChange={e => setFormTax(e.target.value)} placeholder="0,00" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-muted/30 rounded-lg p-3">
              <div>
                <p className="text-xs text-muted-foreground">Escritório recebe</p>
                <p className="text-lg font-bold text-accent">{formOffice ? fmt(parseFloat(formOffice)) : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cliente recebe</p>
                <p className="text-lg font-bold text-foreground">{formClient ? fmt(parseFloat(formClient)) : "—"}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Data Base Cálculo</label>
                <Input type="date" value={formRefDate} onChange={e => setFormRefDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Previsão Pagamento</label>
                <Input type="date" value={formExpDate} onChange={e => setFormExpDate(e.target.value)} />
              </div>
            </div>

            <Textarea placeholder="Observações" value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={resetForm}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Salvando..." : "Salvar Registro"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge variant="outline" className="uppercase">{selected?.type}</Badge>
              {selected?.beneficiary_name || "Pagamento Judicial"}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Valor Bruto</p>
                  <p className="text-lg font-bold">{fmt(selected.gross_amount)}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Select value={selected.status} onValueChange={(v) => updateStatus(selected.id, v)}>
                    <SelectTrigger className="mt-1 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aguardando">Aguardando</SelectItem>
                      <SelectItem value="liberado">Liberado</SelectItem>
                      <SelectItem value="sacado">Sacado</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-accent/5 border border-accent/20 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Escritório ({selected.office_fees_percent}%)</p>
                  <p className="text-lg font-bold text-accent">{fmt(selected.office_amount)}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="text-lg font-bold">{fmt(selected.client_amount)}</p>
                </div>
              </div>

              {(selected.court_costs > 0 || selected.social_security > 0 || selected.income_tax > 0) && (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-muted/20 rounded p-2">
                    <p className="text-muted-foreground">Custas</p>
                    <p className="font-medium">{fmt(selected.court_costs)}</p>
                  </div>
                  <div className="bg-muted/20 rounded p-2">
                    <p className="text-muted-foreground">INSS</p>
                    <p className="font-medium">{fmt(selected.social_security)}</p>
                  </div>
                  <div className="bg-muted/20 rounded p-2">
                    <p className="text-muted-foreground">IR</p>
                    <p className="font-medium">{fmt(selected.income_tax)}</p>
                  </div>
                </div>
              )}

              <div className="space-y-2 text-sm">
                {selected.beneficiary_cpf && <p><span className="text-muted-foreground">CPF:</span> {selected.beneficiary_cpf}</p>}
                {selected.process_number && <p><span className="text-muted-foreground">Processo:</span> <span className="font-mono">{selected.process_number}</span></p>}
                {selected.court && <p><span className="text-muted-foreground">Vara:</span> {selected.court}</p>}
                {selected.entity && <p><span className="text-muted-foreground">Devedor:</span> {selected.entity}</p>}
                {selected.expected_payment_date && <p><span className="text-muted-foreground">Previsão:</span> {new Date(selected.expected_payment_date + "T12:00:00").toLocaleDateString("pt-BR")}</p>}
                {selected.notes && <p><span className="text-muted-foreground">Obs:</span> {selected.notes}</p>}
              </div>

              <div className="flex gap-2 pt-2">
                {selected.document_url && (
                  <Button variant="outline" size="sm" asChild className="gap-1">
                    <a href={selected.document_url} target="_blank" rel="noopener noreferrer">
                      <Eye className="w-4 h-4" /> Ver PDF
                    </a>
                  </Button>
                )}
                <Button variant="destructive" size="sm" className="gap-1 ml-auto" onClick={() => deleteOrder(selected.id)}>
                  <Trash2 className="w-4 h-4" /> Excluir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Pagamentos;
