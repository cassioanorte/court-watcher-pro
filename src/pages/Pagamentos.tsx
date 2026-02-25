import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Banknote, Upload, Trash2, Eye, FileText, Plus, CheckCircle2, Clock, AlertTriangle, X, ExternalLink, Briefcase, Pencil, Save, Users, ArrowDownRight } from "lucide-react";
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
import { extractTextFromPdf, parseRpvText, parseMultiplePayments, type RpvData } from "@/lib/rpvParser";
import { FeeDistributionSection } from "@/components/FeeDistributionSection";
import { createCashFlowEntriesOnSacado, removeCashFlowEntriesOnUnsacado } from "@/lib/cashFlowAutoEntries";
import { computePaymentOrderMath } from "@/lib/paymentOrderMath";



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
  ownership_type: string;
  fee_type: string;
  tax_percent: number | null;
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
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<PaymentOrder>>({});

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
  const [formOwnership, setFormOwnership] = useState("cliente");
  const [formFeeType, setFormFeeType] = useState("contratuais");
  const [formTaxPercent, setFormTaxPercent] = useState("10.9");
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
  // IR applies only on office fees (honorários), NOT on gross amount
  useEffect(() => {
    const gross = parseFloat(formGross) || 0;
    const feeP = parseFloat(formFeePercent) || 0;
    const costs = parseFloat(formCourtCosts) || 0;
    const soc = parseFloat(formSocSec) || 0;
    const taxP = parseFloat(formTaxPercent) || 0;

    if (formOwnership === "escritorio") {
      // 100% do escritório - IR sobre o valor total (que é todo honorário)
      const taxAmount = Math.round(gross * taxP / 100 * 100) / 100;
      setFormTax(taxAmount > 0 ? taxAmount.toString() : "");
      setFormOffice(gross > 0 ? (gross - taxAmount).toString() : "");
      setFormClient("0");
    } else {
      // IR incide somente sobre os honorários do advogado
      const officeGross = Math.round(gross * feeP / 100 * 100) / 100;
      const officeTax = Math.round(officeGross * taxP / 100 * 100) / 100;
      const officeNet = Math.round((officeGross - officeTax) * 100) / 100;
      const clientCalc = Math.round((gross - officeGross - costs - soc) * 100) / 100;
      setFormTax(officeTax > 0 ? officeTax.toString() : "");
      setFormOffice(officeNet > 0 ? officeNet.toString() : "");
      setFormClient(clientCalc > 0 ? clientCalc.toString() : "");
    }
  }, [formGross, formFeePercent, formCourtCosts, formSocSec, formOwnership, formTaxPercent]);

  const applyRpvData = (d: Partial<RpvData>) => {
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
    // Try to auto-match case
    if (d.process_number && cases.length > 0) {
      const cleanNum = d.process_number.replace(/\D/g, "");
      const matchedCase = cases.find(c => c.process_number.replace(/\D/g, "") === cleanNum);
      if (matchedCase) setFormCaseId(matchedCase.id);
    }
  };

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

    // Extract text using pdfjs-dist and parse locally
    setExtracting(true);
    try {
      const pdfText = await extractTextFromPdf(file);

      if (pdfText.trim().length < 20) {
        toast.info("Não foi possível extrair texto do PDF. Preencha os campos manualmente.");
        setExtracting(false);
        setUploading(false);
        return;
      }

      // Try multi-payment parsing first
      const multiResult = parseMultiplePayments(pdfText);
      
      if (multiResult.has_separated_fees && multiResult.entries.length > 1) {
        // Multiple payment entries found (e.g. sucumbência + contratuais)
        // Auto-create all entries directly
        let created = 0;
        // Find matching case
        let matchedCaseId: string | null = null;
        if (multiResult.process_number && cases.length > 0) {
          const cleanNum = multiResult.process_number.replace(/\D/g, "");
          const matchedCase = cases.find(c => c.process_number.replace(/\D/g, "") === cleanNum);
          if (matchedCase) matchedCaseId = matchedCase.id;
        }

        for (const entry of multiResult.entries) {
          const { error } = await supabase.from("payment_orders" as any).insert({
            tenant_id: tenantId,
            created_by: user.id,
            case_id: matchedCaseId,
            type: entry.type || "precatorio",
            status: "aguardando",
            gross_amount: entry.gross_amount || 0,
            office_fees_percent: 0,
            office_amount: entry.office_amount || 0,
            client_amount: 0,
            court_costs: 0,
            social_security: 0,
            income_tax: 0,
            document_url: urlData.publicUrl,
            document_name: file.name,
            beneficiary_name: entry.beneficiary_name || null,
            beneficiary_cpf: entry.beneficiary_cpf || null,
            process_number: multiResult.process_number || null,
            court: null,
            entity: multiResult.entity || null,
            reference_date: entry.reference_date || null,
            expected_payment_date: null,
            ai_extracted: false,
            ai_raw_data: null,
            notes: `Honorários ${entry.fee_type === "sucumbencia" ? "de sucumbência" : "contratuais"} — extraído automaticamente. Pendente de conferência.`,
            ownership_type: "escritorio",
            fee_type: entry.fee_type || "contratuais",
            tax_percent: 10.9,
          });
          if (!error) created++;
        }

        if (created > 0) {
          toast.success(`${created} registro(s) de honorários criados automaticamente! Confira os valores.`);
          resetForm();
          fetchOrders();
        } else {
          toast.error("Erro ao criar registros automáticos.");
        }
      } else {
        // Single payment — use existing flow
        const parsed = multiResult.entries[0] || parseRpvText(pdfText);
        const hasData = parsed.gross_amount || parsed.beneficiary_name || parsed.reference_date || parsed.entity;

        if (hasData) {
          applyRpvData(parsed);
          setFormAiExtracted(false);
          setFormAiRaw(null);
          toast.success("Dados extraídos automaticamente do PDF!");
        } else {
          toast.warning("O PDF trouxe só o número do processo. Tente reenviar ou ajuste manualmente.");
        }
      }
    } catch (err) {
      console.error("PDF extraction error:", err);
      toast.info("Não foi possível ler o PDF. Preencha manualmente.");
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
      ownership_type: formOwnership,
      fee_type: formFeeType,
      tax_percent: parseFloat(formTaxPercent) || 0,
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
    setFormOwnership("cliente");
    setFormFeeType("contratuais");
    setFormTaxPercent("10.9");
    setShowNew(false);
  };

  const updateStatus = async (id: string, newStatus: string) => {
    const order = orders.find(o => o.id === id);
    const oldStatus = order?.status;
    await supabase.from("payment_orders" as any).update({ status: newStatus }).eq("id", id);
    if (order && tenantId && user?.id) {
      if (newStatus === "sacado" && oldStatus !== "sacado") {
        const result = await createCashFlowEntriesOnSacado(order as any, tenantId, user.id);
        if (!result.success) toast.error("Erro ao lançar no caixa: " + result.error);
      } else if (oldStatus === "sacado" && newStatus !== "sacado") {
        await removeCashFlowEntriesOnUnsacado(id, order.process_number, order.beneficiary_name, order.type, tenantId);
      }
    }
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status: newStatus } : null);
    toast.success(newStatus === "sacado" ? "Pago — lançado no caixa" : "Status atualizado");
  };

  const deleteOrder = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este RPV/Precatório? Isso também removerá distribuições de honorários e lançamentos financeiros vinculados.")) return;
    
    const order = orders.find(o => o.id === id);
    
    // 1. Delete fee distributions linked to this payment order
    await supabase.from("fee_distributions").delete().eq("payment_order_id", id);
    
    // 2. Delete financial transactions linked to this order (cash flow entries)
    if (order && tenantId) {
      const label = `${order.type.toUpperCase()} — ${order.process_number || order.beneficiary_name || "Sem número"}`;
      await supabase
        .from("financial_transactions")
        .delete()
        .eq("tenant_id", tenantId)
        .like("description", `%${label}%`)
        .in("category", ["Honorários", "IR sobre Honorários"]);
    }
    
    // 3. Delete eproc_documents linked to this process (so re-capture works)
    if (order && tenantId && order.process_number) {
      await supabase
        .from("eproc_documents")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("process_number", order.process_number);
    }
    
    // 4. Delete the payment order itself
    await supabase.from("payment_orders" as any).delete().eq("id", id);
    
    setOrders(prev => prev.filter(o => o.id !== id));
    setSelected(null);
    toast.success("Registro e dados vinculados excluídos");
  };

  const startEdit = (order: PaymentOrder) => {
    setEditing(true);
    setEditForm({ ...order });
    // Pre-fill the form fields for PDF upload reuse
    setFormDocUrl(order.document_url || "");
    setFormDocName(order.document_name || "");
    setFormAiExtracted(order.ai_extracted || false);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditForm({});
    setFormDocUrl("");
    setFormDocName("");
    setFormAiExtracted(false);
  };

  const handleEditFileUpload = async (file: File) => {
    if (!tenantId || !user?.id) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${tenantId}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from("payment-documents").upload(path, file);
    if (uploadErr) { toast.error("Erro no upload: " + uploadErr.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("payment-documents").getPublicUrl(path);
    setEditForm(f => ({ ...f, document_url: urlData.publicUrl, document_name: file.name }));
    toast.success("PDF enviado!");

    setExtracting(true);
    try {
      const pdfText = await extractTextFromPdf(file);
      if (pdfText.trim().length < 20) { toast.info("Não foi possível extrair texto. Edite manualmente."); setExtracting(false); setUploading(false); return; }

      const multiResult = parseMultiplePayments(pdfText);

      // Multi-fee document: update current order + create additional orders automatically
      if (multiResult.has_separated_fees && multiResult.entries.length > 1 && editForm.id) {
        const processFromDoc = multiResult.process_number || editForm.process_number || null;

        let matchedCaseId = editForm.case_id || null;
        if (!matchedCaseId && processFromDoc && cases.length > 0) {
          const cleanNum = processFromDoc.replace(/\D/g, "");
          const matchedCase = cases.find(c => c.process_number.replace(/\D/g, "") === cleanNum);
          if (matchedCase) matchedCaseId = matchedCase.id;
        }

        const [primaryEntry, ...otherEntries] = multiResult.entries;
        const primaryFeeType = primaryEntry.fee_type || "contratuais";

        const primaryUpdate = {
          type: primaryEntry.type || editForm.type || "precatorio",
          gross_amount: primaryEntry.gross_amount || 0,
          office_fees_percent: 0,
          office_amount: primaryEntry.office_amount || primaryEntry.gross_amount || 0,
          client_amount: 0,
          court_costs: 0,
          social_security: 0,
          income_tax: 0,
          beneficiary_name: primaryEntry.beneficiary_name || null,
          beneficiary_cpf: primaryEntry.beneficiary_cpf || null,
          process_number: processFromDoc,
          court: null,
          entity: multiResult.entity || primaryEntry.entity || null,
          reference_date: primaryEntry.reference_date || null,
          expected_payment_date: null,
          case_id: matchedCaseId,
          document_url: urlData.publicUrl,
          document_name: file.name,
          ownership_type: "escritorio",
          fee_type: primaryFeeType,
          ai_extracted: false,
          ai_raw_data: null,
          notes: `Honorários ${primaryFeeType === "sucumbencia" ? "de sucumbência" : "contratuais"} — extraído automaticamente.`,
        };

        const { error: updateErr } = await supabase
          .from("payment_orders" as any)
          .update(primaryUpdate)
          .eq("id", editForm.id);

        if (updateErr) {
          toast.error("Erro ao atualizar pagamento principal: " + updateErr.message);
          setExtracting(false);
          setUploading(false);
          return;
        }

        let createdExtra = 0;
        for (const entry of otherEntries) {
          const feeType = entry.fee_type || "contratuais";

          const { data: existing } = await supabase
            .from("payment_orders" as any)
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("process_number", processFromDoc)
            .eq("document_name", file.name)
            .eq("fee_type", feeType)
            .limit(1)
            .maybeSingle();

          if (existing) continue;

          const { error } = await supabase.from("payment_orders" as any).insert({
            tenant_id: tenantId,
            created_by: user.id,
            case_id: matchedCaseId,
            type: entry.type || primaryEntry.type || "precatorio",
            status: editForm.status || "aguardando",
            gross_amount: entry.gross_amount || 0,
            office_fees_percent: 0,
            office_amount: entry.office_amount || entry.gross_amount || 0,
            client_amount: 0,
            court_costs: 0,
            social_security: 0,
            income_tax: 0,
            document_url: urlData.publicUrl,
            document_name: file.name,
            beneficiary_name: entry.beneficiary_name || null,
            beneficiary_cpf: entry.beneficiary_cpf || null,
            process_number: processFromDoc,
            court: null,
            entity: multiResult.entity || entry.entity || null,
            reference_date: entry.reference_date || null,
            expected_payment_date: null,
            ai_extracted: false,
            ai_raw_data: null,
            notes: `Honorários ${feeType === "sucumbencia" ? "de sucumbência" : "contratuais"} — extraído automaticamente.`,
            ownership_type: "escritorio",
            fee_type: feeType,
            tax_percent: editForm.tax_percent ?? 10.9,
          });

          if (!error) createdExtra++;
        }

        await fetchOrders();
        setEditForm(f => ({ ...f, ...primaryUpdate }));
        toast.success(`${createdExtra + 1} lançamento(s) de honorários atualizado(s)/criado(s) automaticamente.`);
        setExtracting(false);
        setUploading(false);
        return;
      }

      const parsed = multiResult.entries[0] || parseRpvText(pdfText);
      const hasData = parsed.gross_amount || parsed.beneficiary_name || parsed.reference_date || parsed.entity;

      if (hasData) {
        setEditForm(f => ({
          ...f,
          ...(parsed.type && { type: parsed.type }),
          ...(parsed.gross_amount && { gross_amount: parsed.gross_amount }),
          ...(parsed.office_fees_percent && { office_fees_percent: parsed.office_fees_percent }),
          ...(parsed.court_costs && { court_costs: parsed.court_costs }),
          ...(parsed.social_security && { social_security: parsed.social_security }),
          ...(parsed.income_tax && { income_tax: parsed.income_tax }),
          ...(parsed.beneficiary_name && { beneficiary_name: parsed.beneficiary_name }),
          ...(parsed.beneficiary_cpf && { beneficiary_cpf: parsed.beneficiary_cpf }),
          ...(parsed.process_number && { process_number: parsed.process_number }),
          ...(parsed.court && { court: parsed.court }),
          ...(parsed.entity && { entity: parsed.entity }),
          ...(parsed.reference_date && { reference_date: parsed.reference_date }),
          ...(parsed.expected_payment_date && { expected_payment_date: parsed.expected_payment_date }),
          ...(parsed.fee_type && { fee_type: parsed.fee_type }),
          ...(parsed.ownership_type && { ownership_type: parsed.ownership_type }),
          ai_extracted: false,
        }));
        if (parsed.process_number && cases.length > 0) {
          const cleanNum = parsed.process_number.replace(/\D/g, "");
          const matchedCase = cases.find(c => c.process_number.replace(/\D/g, "") === cleanNum);
          if (matchedCase) setEditForm(f => ({ ...f, case_id: matchedCase.id }));
        }
        toast.success("Dados extraídos e atualizados!");
      } else {
        toast.warning("O PDF trouxe só o número do processo. Edite manualmente os demais campos.");
      }
    } catch (err) { toast.info("Não foi possível ler o PDF. Edite manualmente."); }
    setExtracting(false);
    setUploading(false);
  };

  const saveEdit = async () => {
    if (!editForm.id) return;
    const gross = parseFloat(String(editForm.gross_amount)) || 0;
    const feeP = parseFloat(String(editForm.office_fees_percent)) || 0;
    const costs = parseFloat(String(editForm.court_costs)) || 0;
    const soc = parseFloat(String(editForm.social_security)) || 0;
    const taxP = parseFloat(String(editForm.tax_percent)) || 0;
    const ownership = editForm.ownership_type || "cliente";

    let officeCalc: number;
    let clientCalc: number;
    let taxCalc: number;

    if (ownership === "escritorio") {
      taxCalc = Math.round(gross * taxP / 100 * 100) / 100;
      officeCalc = Math.round((gross - taxCalc) * 100) / 100;
      clientCalc = 0;
    } else {
      const officeGross = Math.round(gross * feeP / 100 * 100) / 100;
      taxCalc = Math.round(officeGross * taxP / 100 * 100) / 100;
      officeCalc = Math.round((officeGross - taxCalc) * 100) / 100;
      clientCalc = Math.round((gross - officeGross - costs - soc) * 100) / 100;
    }

    const updates = {
      type: editForm.type,
      beneficiary_name: editForm.beneficiary_name || null,
      beneficiary_cpf: editForm.beneficiary_cpf || null,
      process_number: editForm.process_number || null,
      court: editForm.court || null,
      entity: editForm.entity || null,
      gross_amount: gross,
      office_fees_percent: feeP,
      office_amount: officeCalc,
      client_amount: clientCalc,
      court_costs: costs,
      social_security: soc,
      income_tax: taxCalc,
      expected_payment_date: editForm.expected_payment_date || null,
      reference_date: editForm.reference_date || null,
      notes: editForm.notes || null,
      case_id: editForm.case_id || null,
      document_url: editForm.document_url || null,
      document_name: editForm.document_name || null,
      ai_extracted: editForm.ai_extracted || false,
      ai_raw_data: editForm.ai_raw_data || null,
      ownership_type: ownership,
      fee_type: editForm.fee_type || "contratuais",
      tax_percent: taxP,
    };

    const { error } = await supabase.from("payment_orders" as any).update(updates).eq("id", editForm.id);
    if (error) { toast.error("Erro ao salvar"); return; }

    const updated = { ...editForm, ...updates, office_amount: officeCalc, client_amount: clientCalc } as PaymentOrder;
    setOrders(prev => prev.map(o => o.id === editForm.id ? { ...o, ...updated } : o));
    setSelected(updated);
    cancelEdit();
    toast.success("Registro atualizado!");
  };

  const fmt = (v: number) => v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00";

  const activeOrders = orders.filter(o => o.status !== "cancelado" && o.status !== "rascunho");
  const totals = activeOrders.reduce(
    (acc, o) => {
      const math = computePaymentOrderMath(o);
      return {
        gross: acc.gross + math.officeGross,
        office: acc.office + math.officeNet,
        ir: acc.ir + math.taxAmount,
      };
    },
    { gross: 0, office: 0, ir: 0 }
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground mb-1">Honorários Brutos (Escritório)</p>
          <p className="text-xl font-bold text-foreground">{fmt(totals.gross)}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground mb-1">IR s/ Honorários</p>
          <p className="text-xl font-bold text-destructive/80">{fmt(totals.ir)}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground mb-1">Honorários Líquidos</p>
          <p className="text-xl font-bold text-accent">{fmt(totals.office)}</p>
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
                   <th className="p-3 font-medium text-right">IR s/ Hon.</th>
                   <th className="p-3 font-medium text-right">Escritório Líq.</th>
                   <th className="p-3 font-medium text-right">Cliente</th>
                   <th className="p-3 font-medium">Status</th>
                   <th className="p-3 font-medium text-right">Ações</th>
                 </tr>
               </thead>
               <tbody>
                 {orders.map((o) => {
                   const st = STATUS_MAP[o.status] || STATUS_MAP.aguardando;
                   const StIcon = st.icon;
                   const officeGross = o.ownership_type === "escritorio" ? o.gross_amount : Math.round(o.gross_amount * (o.office_fees_percent || 0) / 100 * 100) / 100;
                   const irAmount = Math.round(officeGross * (o.tax_percent || 0) / 100 * 100) / 100;
                   return (
                     <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setSelected(o)}>
                       <td className="p-3">
                         <Badge variant="outline" className="text-xs uppercase">{o.type}</Badge>
                       </td>
                       <td className="p-3 text-foreground font-medium">{o.beneficiary_name || "—"}</td>
                       <td className="p-3 text-muted-foreground font-mono text-xs">{o.process_number || getCasePn(o.case_id) || "—"}</td>
                       <td className="p-3 text-right text-foreground">{fmt(o.gross_amount)}</td>
                       <td className="p-3 text-right text-destructive/80 text-xs">{fmt(irAmount)} <span className="text-[10px]">({o.tax_percent ?? 10.9}%)</span></td>
                       <td className="p-3 text-right text-accent font-medium">{fmt(o.office_amount)}</td>
                       <td className="p-3 text-right text-foreground">{fmt(o.client_amount)}</td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${st.color}`}>
                          <StIcon className="w-3 h-3" /> {st.label}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                          {o.document_url && <FileText className="w-4 h-4 text-muted-foreground" />}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelected(o); startEdit(o); }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteOrder(o.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fee Distribution / Cash Flow Section */}
      <FeeDistributionSection 
        orders={orders} 
        tenantId={tenantId} 
        userId={user?.id || ""} 
        fmt={fmt} 
      />

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
          {!formAiExtracted && formDocName && !uploading && !extracting && (
            <Badge variant="secondary" className="text-xs gap-1">
              <CheckCircle2 className="w-3 h-3" /> Dados extraídos do PDF
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
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Classificação</p>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Titularidade</label>
                <Select value={formOwnership} onValueChange={setFormOwnership}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cliente">Do Cliente</SelectItem>
                    <SelectItem value="escritorio">Destacado (Escritório)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Tipo Honorários</label>
                <Select value={formFeeType} onValueChange={setFormFeeType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contratuais">Contratuais</SelectItem>
                    <SelectItem value="sucumbencia">Sucumbência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Imposto (%)</label>
                <Input type="number" step="0.1" value={formTaxPercent} onChange={e => setFormTaxPercent(e.target.value)} placeholder="10.9" />
              </div>
            </div>

            <hr className="border-border" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valores</p>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Valor Bruto (R$)</label>
                <Input type="number" step="0.01" value={formGross} onChange={e => setFormGross(e.target.value)} placeholder="0,00" />
              </div>
              {formOwnership === "cliente" && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Honorários (%)</label>
                  <Input type="number" step="0.1" value={formFeePercent} onChange={e => setFormFeePercent(e.target.value)} />
                </div>
              )}
            </div>

            {formOwnership === "cliente" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Custas</label>
                  <Input type="number" step="0.01" value={formCourtCosts} onChange={e => setFormCourtCosts(e.target.value)} placeholder="0,00" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">INSS</label>
                  <Input type="number" step="0.01" value={formSocSec} onChange={e => setFormSocSec(e.target.value)} placeholder="0,00" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 bg-muted/30 rounded-lg p-3">
              <div>
                <p className="text-xs text-muted-foreground">IR ({formTaxPercent}%)</p>
                <p className="text-sm font-bold text-destructive/80">{formTax ? fmt(parseFloat(formTax)) : "—"}</p>
              </div>
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
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) { setSelected(null); cancelEdit(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge variant="outline" className="uppercase">{selected?.type}</Badge>
              {selected?.beneficiary_name || "Pagamento Judicial"}
            </DialogTitle>
          </DialogHeader>
          {selected && !editing && (
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
                  <p className="text-xs text-muted-foreground">
                    {selected.ownership_type === "escritorio" ? "Escritório (100% destacado)" : `Escritório (${selected.office_fees_percent}%)`}
                  </p>
                  <p className="text-lg font-bold text-accent">{fmt(selected.office_amount)}</p>
                </div>
                {selected.ownership_type !== "escritorio" && (
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Cliente</p>
                    <p className="text-lg font-bold">{fmt(selected.client_amount)}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-xs">
                  {selected.ownership_type === "escritorio" ? "Destacado (Escritório)" : "Do Cliente"}
                </Badge>
                <Badge variant="outline" className="text-xs capitalize">
                  {selected.fee_type || "contratuais"}
                </Badge>
                {selected.tax_percent != null && selected.tax_percent > 0 && (
                  <Badge variant="outline" className="text-xs">
                    Imposto: {selected.tax_percent}%
                  </Badge>
                )}
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
                <Button variant="outline" size="sm" className="gap-1 ml-auto" onClick={() => startEdit(selected)}>
                  <Pencil className="w-4 h-4" /> Editar
                </Button>
                <Button variant="destructive" size="sm" className="gap-1" onClick={() => deleteOrder(selected.id)}>
                  <Trash2 className="w-4 h-4" /> Excluir
                </Button>
              </div>
            </div>
          )}
          {selected && editing && (
            <div className="space-y-3 mt-2">
              {/* PDF Upload for edit */}
              <FileDropZone
                onFile={handleEditFileUpload}
                accept=".pdf"
                loading={uploading || extracting}
                loadingText={extracting ? "Extraindo dados..." : "Enviando..."}
                label="Anexar novo PDF para atualizar dados"
                sublabel="Os campos serão atualizados automaticamente"
                fileName={editForm.document_name || undefined}
                onClear={() => setEditForm(f => ({ ...f, document_url: null, document_name: null }))}
              />
              {editForm.ai_extracted && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Dados extraídos por IA
                </Badge>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
                  <Select value={editForm.type || "rpv"} onValueChange={v => setEditForm(f => ({ ...f, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rpv">RPV</SelectItem>
                      <SelectItem value="precatorio">Precatório</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Vincular Processo</label>
                  <Select value={editForm.case_id || "none"} onValueChange={v => setEditForm(f => ({ ...f, case_id: v === "none" ? null : v }))}>
                    <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {cases.map(c => <SelectItem key={c.id} value={c.id}>{c.process_number}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Beneficiário</label>
                  <Input value={editForm.beneficiary_name || ""} onChange={e => setEditForm(f => ({ ...f, beneficiary_name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">CPF</label>
                  <Input value={editForm.beneficiary_cpf || ""} onChange={e => setEditForm(f => ({ ...f, beneficiary_cpf: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nº do Processo</label>
                <Input value={editForm.process_number || ""} onChange={e => setEditForm(f => ({ ...f, process_number: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Vara/Tribunal</label>
                  <Input value={editForm.court || ""} onChange={e => setEditForm(f => ({ ...f, court: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Entidade Devedora</label>
                  <Input value={editForm.entity || ""} onChange={e => setEditForm(f => ({ ...f, entity: e.target.value }))} />
                </div>
              </div>
              <hr className="border-border" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Classificação</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Titularidade</label>
                  <Select value={editForm.ownership_type || "cliente"} onValueChange={v => setEditForm(f => ({ ...f, ownership_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cliente">Do Cliente</SelectItem>
                      <SelectItem value="escritorio">Destacado (Escritório)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Tipo Honorários</label>
                  <Select value={editForm.fee_type || "contratuais"} onValueChange={v => setEditForm(f => ({ ...f, fee_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                    <SelectItem value="contratuais">Contratuais</SelectItem>
                    <SelectItem value="sucumbencia">Sucumbência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Imposto (%)</label>
                  <Input type="number" step="0.1" value={editForm.tax_percent ?? 10.9} onChange={e => setEditForm(f => ({ ...f, tax_percent: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>
              <hr className="border-border" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valores</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Valor Bruto (R$)</label>
                  <Input type="number" step="0.01" value={editForm.gross_amount ?? ""} onChange={e => setEditForm(f => ({ ...f, gross_amount: parseFloat(e.target.value) || 0 }))} />
                </div>
                {(editForm.ownership_type || "cliente") === "cliente" && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Honorários (%)</label>
                    <Input type="number" step="0.1" value={editForm.office_fees_percent ?? ""} onChange={e => setEditForm(f => ({ ...f, office_fees_percent: parseFloat(e.target.value) || 0 }))} />
                  </div>
                )}
              </div>
              {(editForm.ownership_type || "cliente") === "cliente" && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Custas</label>
                    <Input type="number" step="0.01" value={editForm.court_costs ?? ""} onChange={e => setEditForm(f => ({ ...f, court_costs: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">INSS</label>
                    <Input type="number" step="0.01" value={editForm.social_security ?? ""} onChange={e => setEditForm(f => ({ ...f, social_security: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">IR</label>
                    <Input type="number" step="0.01" value={editForm.income_tax ?? ""} onChange={e => setEditForm(f => ({ ...f, income_tax: parseFloat(e.target.value) || 0 }))} />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Data Base Cálculo</label>
                  <Input type="date" value={editForm.reference_date || ""} onChange={e => setEditForm(f => ({ ...f, reference_date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Previsão Pagamento</label>
                  <Input type="date" value={editForm.expected_payment_date || ""} onChange={e => setEditForm(f => ({ ...f, expected_payment_date: e.target.value }))} />
                </div>
              </div>
              <Textarea placeholder="Observações" value={editForm.notes || ""} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={cancelEdit} className="gap-1">
                  <X className="w-4 h-4" /> Cancelar
                </Button>
                <Button size="sm" onClick={saveEdit} className="gap-1">
                  <Save className="w-4 h-4" /> Salvar
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
