import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileDropZone } from "@/components/ui/file-drop-zone";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Clock, CheckCircle2, AlertTriangle, Search, Filter, Banknote, Trash2, Pencil, Save, X } from "lucide-react";
import { extractTextFromPdf, parseRpvText, parseMultiplePayments, type RpvData } from "@/lib/rpvParser";
import { createCashFlowEntriesOnSacado, removeCashFlowEntriesOnUnsacado } from "@/lib/cashFlowAutoEntries";

interface PaymentOrder {
  id: string;
  type: string;
  status: string;
  gross_amount: number;
  office_fees_percent: number;
  office_amount: number;
  client_amount: number;
  court_costs: number;
  social_security: number;
  income_tax: number;
  beneficiary_name: string | null;
  beneficiary_cpf: string | null;
  process_number: string | null;
  court: string | null;
  entity: string | null;
  reference_date: string | null;
  expected_payment_date: string | null;
  document_url: string | null;
  document_name: string | null;
  ai_extracted: boolean;
  ai_raw_data: any;
  notes: string | null;
  case_id: string | null;
  created_at: string;
  ownership_type: string;
  fee_type: string;
  tax_percent: number | null;
}

interface CaseOption {
  id: string;
  process_number: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  aguardando: { label: "Aguardando", color: "bg-amber-500/10 text-amber-600 border-amber-500/30", icon: Clock },
  liberado: { label: "Liberado", color: "bg-blue-500/10 text-blue-600 border-blue-500/30", icon: CheckCircle2 },
  sacado: { label: "Sacado", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", icon: CheckCircle2 },
  cancelado: { label: "Cancelado", color: "bg-destructive/10 text-destructive border-destructive/30", icon: AlertTriangle },
};

const PaymentOrdersTracker = () => {
  const { tenantId, user } = useAuth();
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [editOrder, setEditOrder] = useState<PaymentOrder | null>(null);
  const [editForm, setEditForm] = useState<Partial<PaymentOrder>>({});
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);

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
    const { data } = await supabase.from("cases").select("id, process_number").eq("tenant_id", tenantId).eq("archived", false).order("process_number").limit(200);
    setCases((data || []) as CaseOption[]);
  }, [tenantId]);

  useEffect(() => { fetchOrders(); fetchCases(); }, [fetchOrders, fetchCases]);

  const togglePaid = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "sacado" ? "aguardando" : "sacado";
    const { error } = await supabase.from("payment_orders" as any).update({ status: newStatus }).eq("id", id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    const order = orders.find(o => o.id === id);
    if (order && tenantId && user?.id) {
      if (newStatus === "sacado") {
        const result = await createCashFlowEntriesOnSacado(order as any, tenantId, user.id);
        if (!result.success) toast.error("Erro ao lançar no caixa: " + result.error);
      } else {
        await removeCashFlowEntriesOnUnsacado(id, order.process_number, order.beneficiary_name, order.type, tenantId);
      }
    }
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
    toast.success(newStatus === "sacado" ? "Marcado como pago — lançado no caixa" : "Revertido — lançamentos removidos do caixa");
  };

  const updateStatus = async (id: string, newStatus: string) => {
    const order = orders.find(o => o.id === id);
    const oldStatus = order?.status;
    const { error } = await supabase.from("payment_orders" as any).update({ status: newStatus }).eq("id", id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    if (order && tenantId && user?.id) {
      if (newStatus === "sacado" && oldStatus !== "sacado") {
        const result = await createCashFlowEntriesOnSacado(order as any, tenantId, user.id);
        if (!result.success) toast.error("Erro ao lançar no caixa: " + result.error);
      } else if (oldStatus === "sacado" && newStatus !== "sacado") {
        await removeCashFlowEntriesOnUnsacado(id, order.process_number, order.beneficiary_name, order.type, tenantId);
      }
    }
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
    toast.success(newStatus === "sacado" ? "Pago — lançado no caixa" : "Status atualizado");
  };

  const startEdit = (o: PaymentOrder) => {
    setEditOrder(o);
    setEditForm({ ...o });
  };

  const cancelEdit = () => {
    setEditOrder(null);
    setEditForm({});
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
      if (multiResult.has_separated_fees && multiResult.entries.length > 1 && editOrder) {
        const processFromDoc = multiResult.process_number || editOrder.process_number || null;

        let matchedCaseId = editOrder.case_id || null;
        if (!matchedCaseId && processFromDoc && cases.length > 0) {
          const cleanNum = processFromDoc.replace(/\D/g, "");
          const matchedCase = cases.find(c => c.process_number.replace(/\D/g, "") === cleanNum);
          if (matchedCase) matchedCaseId = matchedCase.id;
        }

        const [primaryEntry, ...otherEntries] = multiResult.entries;
        const primaryFeeType = primaryEntry.fee_type || "contratuais";

        const primaryUpdate = {
          type: primaryEntry.type || editOrder.type || "precatorio",
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
          .eq("id", editOrder.id);

        if (updateErr) {
          toast.error("Erro ao atualizar pagamento principal: " + updateErr.message);
          setExtracting(false);
          setUploading(false);
          return;
        }

        let createdExtra = 0;
        for (const entry of otherEntries) {
          const feeType = entry.fee_type || "contratuais";

          // Avoid duplicate extra entries for same doc + fee type
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
            status: editOrder.status || "aguardando",
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
            tax_percent: editOrder.tax_percent ?? 10.9,
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

      // Single payment fallback
      const parsed = multiResult.entries[0] || parseRpvText(pdfText);
      const hasData = parsed.gross_amount || parsed.beneficiary_name || parsed.process_number;

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
        toast.info("Poucos dados encontrados. Edite manualmente.");
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
    const tax = parseFloat(String(editForm.income_tax)) || 0;
    const ownership = editForm.ownership_type || "cliente";
    const taxP = parseFloat(String(editForm.tax_percent)) || 0;

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
    setOrders(prev => prev.map(o => o.id === editForm.id ? { ...o, ...updates, office_amount: officeCalc, client_amount: clientCalc } as PaymentOrder : o));
    cancelEdit();
    toast.success("Registro atualizado!");
  };

  const deleteOrder = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este RPV/Precatório?")) return;
    const { error } = await supabase.from("payment_orders" as any).delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    setOrders(prev => prev.filter(o => o.id !== id));
    toast.success("Registro excluído");
  };

  const fmt = (v: number) => v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00";

  const filtered = orders.filter(o => {
    if (filterStatus !== "all" && o.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return (o.beneficiary_name?.toLowerCase().includes(q) || o.process_number?.toLowerCase().includes(q));
    }
    return true;
  });

  const pending = orders.filter(o => o.status === "aguardando" || o.status === "liberado");
  const paid = orders.filter(o => o.status === "sacado");
  const pendingTotal = pending.reduce((s, o) => s + (o.gross_amount || 0), 0);
  const paidTotal = paid.reduce((s, o) => s + (o.gross_amount || 0), 0);

  if (loading) return <p className="text-muted-foreground text-sm p-4">Carregando...</p>;

  return (
    <div className="space-y-6 mt-4">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground mb-1">Total de Processos</p>
          <p className="text-2xl font-bold text-foreground">{orders.length}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground mb-1">Pendentes de Pagamento</p>
          <p className="text-2xl font-bold text-amber-600">{fmt(pendingTotal)}</p>
          <p className="text-xs text-muted-foreground">{pending.length} processo(s)</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground mb-1">Já Pagos</p>
          <p className="text-2xl font-bold text-emerald-600">{fmt(paidTotal)}</p>
          <p className="text-xs text-muted-foreground">{paid.length} processo(s)</p>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por beneficiário ou processo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Filtrar status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="aguardando">Aguardando</SelectItem>
            <SelectItem value="liberado">Liberado</SelectItem>
            <SelectItem value="sacado">Sacado (Pago)</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl border p-8 text-center">
          <Banknote className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">
            {orders.length === 0 ? "Nenhum RPV/Precatório cadastrado. Cadastre na aba RPV / Precatório." : "Nenhum resultado encontrado para os filtros aplicados."}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b text-xs uppercase tracking-wide">
                  <th className="p-3 font-medium w-10">Pago</th>
                  <th className="p-3 font-medium">Tipo</th>
                  <th className="p-3 font-medium">Beneficiário</th>
                  <th className="p-3 font-medium">Processo</th>
                  <th className="p-3 font-medium text-right">Valor Bruto</th>
                  <th className="p-3 font-medium text-right">Escritório</th>
                  <th className="p-3 font-medium text-right">Cliente</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Previsão</th>
                  <th className="p-3 font-medium text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o, i) => {
                  const st = STATUS_MAP[o.status] || STATUS_MAP.aguardando;
                  const StIcon = st.icon;
                  const isPaid = o.status === "sacado";
                  return (
                    <motion.tr
                      key={o.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className={`border-b last:border-0 transition-colors ${isPaid ? "bg-muted/20" : "hover:bg-muted/30"}`}
                    >
                      <td className="p-3">
                        <Checkbox checked={isPaid} onCheckedChange={() => togglePaid(o.id, o.status)} />
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs uppercase">{o.type}</Badge>
                      </td>
                      <td className={`p-3 font-medium ${isPaid ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {o.beneficiary_name || "—"}
                      </td>
                      <td className="p-3 text-muted-foreground font-mono text-xs">
                        {o.process_number || "—"}
                      </td>
                      <td className={`p-3 text-right ${isPaid ? "text-muted-foreground" : "text-foreground"}`}>
                        {fmt(o.gross_amount)}
                      </td>
                      <td className={`p-3 text-right font-medium ${isPaid ? "text-muted-foreground" : "text-accent"}`}>
                        {fmt(o.office_amount)}
                      </td>
                      <td className={`p-3 text-right ${isPaid ? "text-muted-foreground" : "text-foreground"}`}>
                        {fmt(o.client_amount)}
                      </td>
                      <td className="p-3">
                        <Select value={o.status} onValueChange={(v) => updateStatus(o.id, v)}>
                          <SelectTrigger className="h-7 text-xs w-[130px] border-0 bg-transparent p-0">
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${st.color}`}>
                              <StIcon className="w-3 h-3" /> {st.label}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="aguardando">Aguardando</SelectItem>
                            <SelectItem value="liberado">Liberado</SelectItem>
                            <SelectItem value="sacado">Sacado (Pago)</SelectItem>
                            <SelectItem value="cancelado">Cancelado</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {o.expected_payment_date ? new Date(o.expected_payment_date + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => startEdit(o)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteOrder(o.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editOrder} onOpenChange={(open) => { if (!open) cancelEdit(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar {editForm.type === "precatorio" ? "Precatório" : "RPV"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {/* PDF Upload */}
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
                <Input value={editForm.entity || ""} onChange={e => setEditForm(f => ({ ...f, entity: e.target.value }))} placeholder="INSS, União..." />
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
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Honorários (%)</label>
                <Input type="number" step="0.1" value={editForm.office_fees_percent ?? ""} onChange={e => setEditForm(f => ({ ...f, office_fees_percent: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
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
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentOrdersTracker;
