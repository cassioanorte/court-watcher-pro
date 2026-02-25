import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { computePaymentOrderMath } from "@/lib/paymentOrderMath";
import { motion } from "framer-motion";
import { Banknote, Calendar, ArrowLeft, TrendingUp, Filter, Clock, CheckCircle2, FileText, ExternalLink, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { format, parseISO, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, addDays, addMonths, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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
  expected_payment_date: string | null;
  fee_type: string;
  case_id: string | null;
  document_url: string | null;
  document_name: string | null;
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
  const [loading, setLoading] = useState(true);
  const [periodMode, setPeriodMode] = useState<PeriodMode>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from("payment_orders" as any)
      .select("id, type, status, gross_amount, office_amount, client_amount, income_tax, tax_percent, office_fees_percent, ownership_type, process_number, beneficiary_name, expected_payment_date, fee_type, case_id, document_url, document_name")
      .eq("tenant_id", tenantId)
      .in("status", ["aguardando", "liberado"])
      .then(({ data }) => {
        setOrders((data || []) as unknown as PaymentOrder[]);
        setLoading(false);
      });
  }, [tenantId]);

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
      default: return null; // "all"
    }
  }, [periodMode, customFrom, customTo]);

  // Filter orders by date range
  const filteredOrders = useMemo(() => {
    if (!dateRange) return orders;
    return orders.filter((o) => {
      if (!o.expected_payment_date) return periodMode === "all";
      try {
        const d = parseISO(o.expected_payment_date);
        return isWithinInterval(d, { start: dateRange.from, end: dateRange.to });
      } catch {
        return false;
      }
    });
  }, [orders, dateRange, periodMode]);

  // Orders without date (always shown in a separate section)
  const ordersWithoutDate = useMemo(() => {
    if (periodMode === "all") return [];
    return orders.filter((o) => !o.expected_payment_date);
  }, [orders, periodMode]);

  // Totals
  const totals = useMemo(() => {
    const computedFiltered = filteredOrders.map((o) => computePaymentOrderMath(o as any));
    const computedWithout = ordersWithoutDate.map((o) => computePaymentOrderMath(o as any));
    return {
      officeGross: computedFiltered.reduce((s, m) => s + m.officeGross, 0),
      officeNet: computedFiltered.reduce((s, m) => s + m.officeNet, 0),
      taxAmount: computedFiltered.reduce((s, m) => s + m.taxAmount, 0),
      count: filteredOrders.length,
      withoutDateGross: computedWithout.reduce((s, m) => s + m.officeGross, 0),
      withoutDateNet: computedWithout.reduce((s, m) => s + m.officeNet, 0),
      withoutDateCount: ordersWithoutDate.length,
    };
  }, [filteredOrders, ordersWithoutDate]);

  // Monthly breakdown chart
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
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
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
            <Banknote className="w-6 h-6 text-blue-500" /> Honorários Previstos
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
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
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
          <p className="text-2xl font-bold text-emerald-600 mt-1">{fmt(totals.officeNet)}</p>
          <p className="text-xs text-muted-foreground mt-1">após dedução de IR ({fmt(totals.taxAmount)})</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-xl p-5 border shadow-card">
          <p className="text-sm text-muted-foreground">Sem data prevista</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{fmt(totals.withoutDateNet)}</p>
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
                <th className="text-center p-3 font-medium text-muted-foreground">Documento</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {[...filteredOrders, ...ordersWithoutDate].map((o) => {
                const m = computePaymentOrderMath(o as any);
                return (
                  <tr key={o.id} className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => o.case_id && navigate(`/processos/${o.case_id}`)}>
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
                    <td className="p-3 text-right text-red-500">{fmt(m.taxAmount)}</td>
                    <td className="p-3 text-right font-bold text-emerald-600">{fmt(m.officeNet)}</td>
                    <td className="p-3 text-muted-foreground">
                      {o.expected_payment_date
                        ? format(parseISO(o.expected_payment_date), "dd/MM/yyyy")
                        : <span className="text-amber-500 text-xs">Sem data</span>}
                    </td>
                    <td className="p-3 text-center">
                      {o.document_url ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(o.document_url!, "_blank");
                          }}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          PDF
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/pagamentos?edit=${o.id}`);
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" /> Editar
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filteredOrders.length === 0 && ordersWithoutDate.length === 0 && (
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Nenhum honorário previsto no período selecionado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HonorariosPrevistos;
