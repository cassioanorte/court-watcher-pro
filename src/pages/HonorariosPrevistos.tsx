import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { computePaymentOrderMath } from "@/lib/paymentOrderMath";
import { motion } from "framer-motion";
import { Banknote, ArrowLeft, TrendingUp, Filter, Pencil, Save, X, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { format, parseISO, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, addDays, addMonths, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";

interface PaymentOrder {
  id: string;
  type: string;
  status: string;
  gross_amount: number;
  office_amount: number;
  client_amount: number;
  income_tax: number;
  tax_percent: number;
  office_fees_percent: number;
  ownership_type: string;
  process_number: string | null;
  beneficiary_name: string | null;
  beneficiary_cpf: string | null;
  expected_payment_date: string | null;
  fee_type: string;
  case_id: string | null;
  document_url: string | null;
  document_name: string | null;
  court: string | null;
  entity: string | null;
  reference_date: string | null;
  court_costs: number;
  social_security: number;
  notes: string | null;
}

interface CaseOption {
  id: string;
  process_number: string;
}

const STATUS_LABELS: Record<string, string> = {
  aguardando: "Aguardando",
  liberado: "Liberado",
};

const STATUS_COLORS: Record<string, string> = {
  aguardando: "bg-amber-500/10 text-amber-600 border-amber-200",
  liberado: "bg-blue-500/10 text-blue-600 border-blue-200",
};

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type PeriodMode = "all" | "custom" | "7d" | "30d" | "90d" | "month" | "quarter" | "year";

const HonorariosPrevistos = () => {
  const { tenantId } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodMode, setPeriodMode] = useState<PeriodMode>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Edit state
  const [editingOrder, setEditingOrder] = useState<PaymentOrder | null>(null);
  const [editForm, setEditForm] = useState<Partial<PaymentOrder>>({});

  useEffect(() => {
    if (!tenantId) return;
    Promise.all([
      supabase
        .from("payment_orders" as any)
        .select("id, type, status, gross_amount, office_amount, client_amount, income_tax, tax_percent, office_fees_percent, ownership_type, process_number, beneficiary_name, beneficiary_cpf, expected_payment_date, fee_type, case_id, document_url, document_name, court, entity, reference_date, court_costs, social_security, notes")
        .eq("tenant_id", tenantId)
        .in("status", ["aguardando", "liberado"]),
      supabase
        .from("cases")
        .select("id, process_number")
        .eq("tenant_id", tenantId)
        .eq("archived", false)
        .order("process_number")
        .limit(200),
    ]).then(([poRes, casesRes]) => {
      setOrders((poRes.data || []) as unknown as PaymentOrder[]);
      setCases((casesRes.data || []) as CaseOption[]);
      setLoading(false);
    });
  }, [tenantId]);

  // Open edit dialog
  const openEdit = (order: PaymentOrder) => {
    setEditingOrder(order);
    setEditForm({ ...order });
  };

  const closeEdit = () => {
    setEditingOrder(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (!editForm.id) return;
    const gross = parseFloat(String(editForm.gross_amount)) || 0;
    const feeP = parseFloat(String(editForm.office_fees_percent)) || 0;
    const costs = parseFloat(String(editForm.court_costs)) || 0;
    const soc = parseFloat(String(editForm.social_security)) || 0;
    const taxP = parseFloat(String(editForm.tax_percent)) || 0;
    const ownership = editForm.ownership_type || "cliente";

    let officeCalc: number, clientCalc: number, taxCalc: number;

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
      ownership_type: ownership,
      fee_type: editForm.fee_type || "contratuais",
      tax_percent: taxP,
    };

    const { error } = await supabase.from("payment_orders" as any).update(updates).eq("id", editForm.id);
    if (error) { toast.error("Erro ao salvar"); return; }

    const updated = { ...editingOrder, ...editForm, ...updates, office_amount: officeCalc, client_amount: clientCalc } as PaymentOrder;
    setOrders(prev => prev.map(o => o.id === editForm.id ? updated : o));
    closeEdit();
    toast.success("Registro atualizado!");
  };

  // Compute date range based on period mode
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (periodMode) {
      case "7d": return { from: startOfDay(now), to: endOfDay(addDays(now, 7)) };
      case "30d": return { from: startOfDay(now), to: endOfDay(addDays(now, 30)) };
      case "90d": return { from: startOfDay(now), to: endOfDay(addDays(now, 90)) };
      case "month": return { from: startOfMonth(now), to: endOfMonth(now) };
      case "quarter": return { from: startOfMonth(now), to: endOfMonth(addMonths(now, 2)) };
      case "year": return { from: startOfYear(now), to: endOfYear(now) };
      case "custom":
        if (customFrom && customTo) return { from: parseISO(customFrom), to: parseISO(customTo) };
        return null;
      default: return null;
    }
  }, [periodMode, customFrom, customTo]);

  const filteredOrders = useMemo(() => {
    if (!dateRange) return orders;
    return orders.filter((o) => {
      if (!o.expected_payment_date) return periodMode === "all";
      try {
        return isWithinInterval(parseISO(o.expected_payment_date), { start: dateRange.from, end: dateRange.to });
      } catch { return false; }
    });
  }, [orders, dateRange, periodMode]);

  const ordersWithoutDate = useMemo(() => {
    if (periodMode === "all") return [];
    return orders.filter((o) => !o.expected_payment_date);
  }, [orders, periodMode]);

  const totals = useMemo(() => {
    const cf = filteredOrders.map((o) => computePaymentOrderMath(o as any));
    const cw = ordersWithoutDate.map((o) => computePaymentOrderMath(o as any));
    return {
      officeGross: cf.reduce((s, m) => s + m.officeGross, 0),
      officeNet: cf.reduce((s, m) => s + m.officeNet, 0),
      taxAmount: cf.reduce((s, m) => s + m.taxAmount, 0),
      count: filteredOrders.length,
      withoutDateGross: cw.reduce((s, m) => s + m.officeGross, 0),
      withoutDateNet: cw.reduce((s, m) => s + m.officeNet, 0),
      withoutDateCount: ordersWithoutDate.length,
    };
  }, [filteredOrders, ordersWithoutDate]);

  const monthlyChart = useMemo(() => {
    const map: Record<string, { label: string; bruto: number; liquido: number }> = {};
    orders.forEach((o) => {
      if (!o.expected_payment_date) return;
      const d = parseISO(o.expected_payment_date);
      const key = format(d, "yyyy-MM");
      const label = format(d, "MMM/yy", { locale: ptBR });
      if (!map[key]) map[key] = { label, bruto: 0, liquido: 0 };
      const m = computePaymentOrderMath(o as any);
      map[key].bruto += m.officeGross;
      map[key].liquido += m.officeNet;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [orders]);

  if (loading) return <div className="text-muted-foreground text-sm p-4">Carregando...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/financeiro")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Banknote className="w-6 h-6 text-accent" /> Honorários Previstos
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            RPVs e Precatórios aguardando pagamento — filtre por período para projetar receitas
          </p>
        </div>
      </div>

      {/* Period filter */}
      <div className="bg-card rounded-xl p-4 border shadow-card space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Filter className="w-4 h-4" /> Filtrar por período de pagamento previsto
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Select value={periodMode} onValueChange={(v) => setPeriodMode(v as PeriodMode)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="7d">Próximos 7 dias</SelectItem>
              <SelectItem value="30d">Próximos 30 dias</SelectItem>
              <SelectItem value="90d">Próximos 90 dias</SelectItem>
              <SelectItem value="month">Este mês</SelectItem>
              <SelectItem value="quarter">Este trimestre</SelectItem>
              <SelectItem value="year">Este ano</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          {periodMode === "custom" && (
            <div className="flex items-center gap-2">
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-40" />
              <span className="text-muted-foreground text-sm">até</span>
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-40" />
            </div>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-5 border shadow-card">
          <p className="text-sm text-muted-foreground">Honorários Brutos (Escritório)</p>
          <p className="text-2xl font-bold text-foreground mt-1">{fmt(totals.officeGross)}</p>
          <p className="text-xs text-muted-foreground mt-1">{totals.count} ordem(ns) no período</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-card rounded-xl p-5 border shadow-card">
          <p className="text-sm text-muted-foreground">Honorários Líquidos</p>
          <p className="text-2xl font-bold text-accent mt-1">{fmt(totals.officeNet)}</p>
          <p className="text-xs text-muted-foreground mt-1">após dedução de IR ({fmt(totals.taxAmount)})</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-xl p-5 border shadow-card">
          <p className="text-sm text-muted-foreground">Sem data prevista</p>
          <p className="text-2xl font-bold text-foreground mt-1">{fmt(totals.withoutDateNet)}</p>
          <p className="text-xs text-muted-foreground mt-1">{totals.withoutDateCount} ordem(ns)</p>
        </motion.div>
      </div>

      {/* Monthly chart */}
      {monthlyChart.length > 0 && (
        <div className="bg-card rounded-xl p-5 border shadow-card">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-accent" /> Previsão por mês
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyChart}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Bar dataKey="bruto" name="Bruto" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} opacity={0.4} />
              <Bar dataKey="liquido" name="Líquido" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Orders table */}
      <div className="bg-card rounded-xl border shadow-card overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="text-sm font-semibold text-foreground">Detalhamento</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Tipo</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Processo / Beneficiário</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Bruto (Escrit.)</th>
                <th className="text-right p-3 font-medium text-muted-foreground">IR</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Líquido</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Pgto previsto</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {[...filteredOrders, ...ordersWithoutDate].map((o) => {
                const m = computePaymentOrderMath(o as any);
                return (
                  <tr key={o.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <Badge variant="outline" className="text-xs uppercase">{o.type}</Badge>
                    </td>
                    <td className="p-3 font-medium text-foreground">
                      {o.process_number || o.beneficiary_name || "—"}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={`text-xs ${STATUS_COLORS[o.status] || ""}`}>
                        {STATUS_LABELS[o.status] || o.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right font-medium">{fmt(m.officeGross)}</td>
                    <td className="p-3 text-right text-destructive">{fmt(m.taxAmount)}</td>
                    <td className="p-3 text-right font-bold text-accent">{fmt(m.officeNet)}</td>
                    <td className="p-3 text-muted-foreground">
                      {o.expected_payment_date
                        ? format(parseISO(o.expected_payment_date), "dd/MM/yyyy")
                        : <span className="text-muted-foreground text-xs italic">Sem data</span>}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {o.document_url && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                            if (o.process_number) {
                              const num = o.process_number;
                              if (navigator.clipboard?.writeText) {
                                navigator.clipboard.writeText(num).then(() => toast.success(`Nº ${num} copiado!`));
                              } else {
                                const ta = document.createElement("textarea");
                                ta.value = num;
                                document.body.appendChild(ta);
                                ta.select();
                                document.execCommand("copy");
                                document.body.removeChild(ta);
                                toast.success(`Nº ${num} copiado!`);
                              }
                            }
                            window.open(o.document_url!, "_blank", "noopener,noreferrer");
                          }}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(o)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredOrders.length === 0 && ordersWithoutDate.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Nenhum honorário previsto no período selecionado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== EDIT DIALOG ===== */}
      <Dialog open={!!editingOrder} onOpenChange={(open) => { if (!open) closeEdit(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4" /> Editar {editForm.type?.toUpperCase() || "Pagamento"}
            </DialogTitle>
          </DialogHeader>
          {editingOrder && (
            <div className="space-y-3 mt-2">
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
                <Button variant="outline" size="sm" onClick={closeEdit} className="gap-1">
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

export default HonorariosPrevistos;
