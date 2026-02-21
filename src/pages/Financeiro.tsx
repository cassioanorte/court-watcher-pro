import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  DollarSign, TrendingUp, TrendingDown, PiggyBank, Plus, Trash2, X, Save,
  ArrowUpRight, ArrowDownRight, BarChart3, Target, Calendar, Banknote, Clock,
  CheckCircle2, AlertTriangle, Users, Briefcase, Scale, Wallet
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Pagamentos from "@/pages/Pagamentos";
import PaymentOrdersTracker from "@/components/PaymentOrdersTracker";
import FluxoDeCaixa from "@/components/FluxoDeCaixa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend
} from "recharts";
import { format, startOfMonth, endOfMonth, subMonths, addMonths, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Transaction {
  id: string;
  type: "revenue" | "expense";
  category: string;
  description: string | null;
  amount: number;
  date: string;
  status: string;
  case_id: string | null;
}

interface CaseOption {
  id: string;
  process_number: string;
  subject: string | null;
  client_user_id: string | null;
}

interface ClientOption {
  user_id: string;
  full_name: string;
}

interface PaymentOrderFull {
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
}

interface FeeDistribution {
  id: string;
  payment_order_id: string;
  lawyer_user_id: string;
  lawyer_name: string;
  amount: number;
}

const REVENUE_CATEGORIES = ["Honorários", "Consultoria", "Acordo", "Êxito", "Outros"];
const EXPENSE_CATEGORIES = [
  "Aluguel", "Salários", "Encargos Trabalhistas", "Pró-labore", "Impostos", "INSS", "ISS", "IRPJ/CSLL",
  "Custas Processuais", "Despesas Processuais", "Taxas Judiciais", "Certidões e Diligências",
  "Honorários Periciais", "Correios e Intimações",
  "Material de Escritório", "Tecnologia e Software", "Telefone e Internet",
  "Marketing e Publicidade", "Energia Elétrica", "Água", "Condomínio", "IPTU",
  "Seguros", "Manutenção e Limpeza", "Contabilidade", "Transporte e Combustível",
  "Estacionamento", "Viagens e Deslocamentos", "Alimentação", "Assinaturas e Publicações",
  "Capacitação e Cursos", "OAB - Anuidade", "Despesas Bancárias", "Outros"
];
const PIE_COLORS = ["hsl(var(--accent))", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#6b7280"];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  aguardando: { label: "Aguardando", color: "text-amber-600", icon: Clock },
  liberado: { label: "Liberado", color: "text-blue-600", icon: CheckCircle2 },
  sacado: { label: "Sacado", color: "text-emerald-600", icon: CheckCircle2 },
  cancelado: { label: "Cancelado", color: "text-destructive", icon: AlertTriangle },
};

const Financeiro = () => {
  const { tenantId, user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [paymentOrders, setPaymentOrders] = useState<PaymentOrderFull[]>([]);
  const [feeDistributions, setFeeDistributions] = useState<FeeDistribution[]>([]);
  const [form, setForm] = useState({
    type: "revenue" as "revenue" | "expense",
    category: "",
    description: "",
    amount: "",
    date: format(new Date(), "yyyy-MM-dd"),
    status: "confirmed",
    case_id: "",
    client_user_id: "",
  });

  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      const [txRes, casesRes, profilesRes, poRes, fdRes] = await Promise.all([
        supabase.from("financial_transactions").select("id, type, category, description, amount, date, status, case_id").eq("tenant_id", tenantId).order("date", { ascending: false }),
        supabase.from("cases").select("id, process_number, subject, client_user_id").eq("tenant_id", tenantId),
        supabase.from("profiles").select("user_id, full_name").eq("tenant_id", tenantId),
        supabase.from("payment_orders" as any).select("id, type, status, gross_amount, office_amount, client_amount, income_tax, tax_percent, office_fees_percent, ownership_type, process_number, beneficiary_name, expected_payment_date, fee_type").eq("tenant_id", tenantId),
        supabase.from("fee_distributions" as any).select("id, payment_order_id, lawyer_user_id, lawyer_name, amount").eq("tenant_id", tenantId),
      ]);
      setTransactions((txRes.data as Transaction[]) || []);
      setCases(casesRes.data || []);
      setPaymentOrders((poRes.data || []) as unknown as PaymentOrderFull[]);
      setFeeDistributions((fdRes.data || []) as unknown as FeeDistribution[]);
      const allProfiles = profilesRes.data || [];
      const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("user_id", allProfiles.map(p => p.user_id));
      const clientIds = new Set((roles || []).filter(r => r.role === "client").map(r => r.user_id));
      setClients(allProfiles.filter(p => clientIds.has(p.user_id)));
      setLoading(false);
    };
    load();
  }, [tenantId]);

  const handleCreate = async () => {
    if (!form.category || !form.amount || !tenantId || !user?.id) return;
    const { data, error } = await supabase.from("financial_transactions").insert({
      tenant_id: tenantId,
      created_by: user.id,
      type: form.type,
      category: form.category,
      description: form.description || null,
      amount: parseFloat(form.amount),
      date: form.date,
      status: form.status,
      case_id: form.case_id || null,
      client_user_id: form.client_user_id || null,
    } as any).select().single();
    if (error) { toast.error("Erro ao criar transação"); return; }
    setTransactions((prev) => [data as Transaction, ...prev]);
    setForm({ type: "revenue", category: "", description: "", amount: "", date: format(new Date(), "yyyy-MM-dd"), status: "confirmed", case_id: "", client_user_id: "" });
    setShowModal(false);
    toast.success("Transação adicionada!");
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("financial_transactions").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    toast.success("Transação removida");
  };

  // === COMPUTATIONS ===
  const confirmed = transactions.filter((t) => t.status === "confirmed");
  const totalRevenue = confirmed.filter((t) => t.type === "revenue").reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = confirmed.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const profit = totalRevenue - totalExpense;

  // Payment orders totals
  const activeOrders = paymentOrders.filter(o => o.status !== "cancelado");
  const totalHonorariosPrevistos = activeOrders.reduce((s, o) => s + (Number(o.office_amount) || 0), 0);
  const totalBrutoRpv = activeOrders.reduce((s, o) => s + (Number(o.gross_amount) || 0), 0);

  // IR a pagar — calcula usando tax_percent sobre honorários brutos
  const totalIrAPagar = activeOrders
    .filter(o => o.status !== "sacado")
    .reduce((s, o) => {
      const officeGross = (o as any).ownership_type === "escritorio"
        ? (Number(o.gross_amount) || 0)
        : Math.round((Number(o.gross_amount) || 0) * (Number((o as any).office_fees_percent) || 0) / 100 * 100) / 100;
      return s + Math.round(officeGross * (Number(o.tax_percent) || 0) / 100 * 100) / 100;
    }, 0);

  // === RPV DASHBOARD DATA ===
  // Status breakdown
  const statusBreakdown = useMemo(() => {
    const map: Record<string, { count: number; officeTotal: number; grossTotal: number }> = {};
    activeOrders.forEach(o => {
      if (!map[o.status]) map[o.status] = { count: 0, officeTotal: 0, grossTotal: 0 };
      map[o.status].count++;
      map[o.status].officeTotal += Number(o.office_amount) || 0;
      map[o.status].grossTotal += Number(o.gross_amount) || 0;
    });
    return map;
  }, [activeOrders]);

  // Upcoming payments
  const upcomingPayments = useMemo(() => {
    const today = new Date();
    return activeOrders
      .filter(o => o.expected_payment_date && o.status !== "sacado")
      .map(o => ({ ...o, daysUntil: differenceInDays(parseISO(o.expected_payment_date!), today) }))
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 5);
  }, [activeOrders]);

  // Fee distribution tracking
  const distributionSummary = useMemo(() => {
    const totalDistributed = feeDistributions.reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const pendingDistribution = totalHonorariosPrevistos - totalDistributed;
    const percentDistributed = totalHonorariosPrevistos > 0 ? (totalDistributed / totalHonorariosPrevistos) * 100 : 0;

    // By lawyer
    const byLawyer: Record<string, { name: string; total: number }> = {};
    feeDistributions.forEach(d => {
      if (!byLawyer[d.lawyer_user_id]) byLawyer[d.lawyer_user_id] = { name: d.lawyer_name, total: 0 };
      byLawyer[d.lawyer_user_id].total += Number(d.amount) || 0;
    });

    // Orders with no distribution
    const distributedOrderIds = new Set(feeDistributions.map(d => d.payment_order_id));
    const ordersWithoutDist = activeOrders.filter(o => !distributedOrderIds.has(o.id) && Number(o.office_amount) > 0);

    return { totalDistributed, pendingDistribution, percentDistributed, byLawyer, ordersWithoutDist };
  }, [feeDistributions, activeOrders, totalHonorariosPrevistos]);

  // RPV vs Precatório chart
  const rpvVsPrecatorio = useMemo(() => {
    const rpv = activeOrders.filter(o => o.type === "rpv");
    const prec = activeOrders.filter(o => o.type === "precatorio");
    return [
      { name: "RPV", quantidade: rpv.length, bruto: rpv.reduce((s, o) => s + (Number(o.gross_amount) || 0), 0), honorarios: rpv.reduce((s, o) => s + (Number(o.office_amount) || 0), 0) },
      { name: "Precatório", quantidade: prec.length, bruto: prec.reduce((s, o) => s + (Number(o.gross_amount) || 0), 0), honorarios: prec.reduce((s, o) => s + (Number(o.office_amount) || 0), 0) },
    ];
  }, [activeOrders]);

  // Monthly data for last 6 months
  const monthlyData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const monthTx = confirmed.filter((t) => {
        const td = parseISO(t.date);
        return td >= start && td <= end;
      });
      const rev = monthTx.filter((t) => t.type === "revenue").reduce((s, t) => s + Number(t.amount), 0);
      const exp = monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
      months.push({
        month: format(d, "MMM/yy", { locale: ptBR }),
        receitas: rev,
        despesas: exp,
        lucro: rev - exp,
      });
    }
    return months;
  }, [confirmed]);

  const projections = useMemo(() => {
    if (monthlyData.length === 0) return [];
    const avgRev = monthlyData.reduce((s, m) => s + m.receitas, 0) / monthlyData.length;
    const avgExp = monthlyData.reduce((s, m) => s + m.despesas, 0) / monthlyData.length;
    const result = [];
    for (let i = 1; i <= 3; i++) {
      const d = addMonths(new Date(), i);
      result.push({
        month: format(d, "MMM/yy", { locale: ptBR }),
        receitas: Math.round(avgRev),
        despesas: Math.round(avgExp),
        lucro: Math.round(avgRev - avgExp),
      });
    }
    return result;
  }, [monthlyData]);

  const chartData = [...monthlyData, ...projections.map((p) => ({ ...p, month: `${p.month}*` }))];

  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    confirmed.filter((t) => t.type === "expense").forEach((t) => {
      map[t.category] = (map[t.category] || 0) + Number(t.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [confirmed]);

  const revenueByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    confirmed.filter((t) => t.type === "revenue").forEach((t) => {
      map[t.category] = (map[t.category] || 0) + Number(t.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [confirmed]);

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const openExpenseModal = () => {
    setForm({ ...form, type: "expense", category: "" });
    setShowModal(true);
  };

  const kpis = [
    { label: "Receitas", value: fmt(totalRevenue), icon: TrendingUp, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
    { label: "Despesas", value: fmt(totalExpense), icon: TrendingDown, color: "text-red-500", bgColor: "bg-red-500/10", clickable: true, onClick: openExpenseModal },
    { label: "Lucro Líquido", value: fmt(profit), icon: PiggyBank, color: profit >= 0 ? "text-emerald-500" : "text-red-500", bgColor: profit >= 0 ? "bg-emerald-500/10" : "bg-red-500/10" },
    { label: "IR a Pagar", value: fmt(totalIrAPagar), icon: Target, color: "text-amber-500", bgColor: "bg-amber-500/10", subtitle: `sobre RPVs/Precatórios pendentes` },
    { label: "Honorários Previstos", value: fmt(totalHonorariosPrevistos), icon: Banknote, color: "text-blue-500", bgColor: "bg-blue-500/10", subtitle: `de ${fmt(totalBrutoRpv)} em RPV/Precatórios` },
  ];

  if (loading) return <div className="text-muted-foreground text-sm p-4">Carregando...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão completa da saúde financeira do escritório</p>
      </div>

      <Tabs defaultValue="visao-geral" className="w-full">
        <TabsList>
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="rpv-precatorio" className="gap-1.5">
            <Banknote className="w-4 h-4" /> RPV / Precatório
          </TabsTrigger>
          <TabsTrigger value="aguardando-pagamento" className="gap-1.5">
            <Clock className="w-4 h-4" /> Aguardando Pagamento
          </TabsTrigger>
          <TabsTrigger value="fluxo-caixa" className="gap-1.5">
            <Wallet className="w-4 h-4" /> Fluxo de Caixa
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral">
          <div className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={() => setShowModal(true)} className="gap-1">
                <Plus className="w-4 h-4" /> Nova Transação
              </Button>
            </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className={`bg-card rounded-lg p-5 shadow-card border ${"clickable" in kpi && kpi.clickable ? "cursor-pointer hover:border-primary/50 hover:shadow-md transition-all" : ""}`}
            onClick={"onClick" in kpi && kpi.onClick ? kpi.onClick as () => void : undefined}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                <p className="text-xl font-bold text-foreground mt-1 font-display">{kpi.value}</p>
                {"subtitle" in kpi && kpi.subtitle && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">{kpi.subtitle}</p>
                )}
                {"clickable" in kpi && kpi.clickable && (
                  <p className="text-[10px] text-primary mt-1 flex items-center gap-0.5"><Plus className="w-3 h-3" /> Lançar despesa</p>
                )}
              </div>
              <div className={`w-10 h-10 rounded-lg ${kpi.bgColor} flex items-center justify-center`}>
                <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ===== RPV/PRECATÓRIO DASHBOARD ===== */}
      {activeOrders.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Scale className="w-4 h-4 text-accent" /> Painel de RPV / Precatórios
          </h2>

          {/* Status breakdown cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(statusBreakdown).map(([status, data]) => {
              const config = STATUS_CONFIG[status] || { label: status, color: "text-muted-foreground", icon: Clock };
              const IconComp = config.icon;
              return (
                <motion.div key={status} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="bg-card rounded-lg border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <IconComp className={`w-4 h-4 ${config.color}`} />
                    <span className={`text-xs font-semibold uppercase tracking-wide ${config.color}`}>{config.label}</span>
                    <Badge variant="secondary" className="ml-auto text-xs">{data.count}</Badge>
                  </div>
                  <p className="text-lg font-bold text-foreground">{fmt(data.officeTotal)}</p>
                  <p className="text-[10px] text-muted-foreground">Bruto: {fmt(data.grossTotal)}</p>
                </motion.div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* RPV vs Precatório chart */}
            <div className="bg-card rounded-lg border shadow-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-accent" /> RPV vs Precatório
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={rpvVsPrecatorio} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="bruto" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Valor Bruto" />
                  <Bar dataKey="honorarios" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="Honorários" />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2 text-xs text-muted-foreground justify-center">
                {rpvVsPrecatorio.map(r => (
                  <span key={r.name}>{r.name}: {r.quantidade} ({fmt(r.honorarios)})</span>
                ))}
              </div>
            </div>

            {/* Fee distribution tracking */}
            <div className="bg-card rounded-lg border shadow-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-accent" /> Rateio de Honorários
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Distribuído</span>
                    <span className="font-medium text-foreground">{distributionSummary.percentDistributed.toFixed(1)}%</span>
                  </div>
                  <Progress value={Math.min(distributionSummary.percentDistributed, 100)} className="h-2" />
                  <div className="flex justify-between text-xs mt-1 text-muted-foreground">
                    <span>{fmt(distributionSummary.totalDistributed)} distribuído</span>
                    <span>{fmt(distributionSummary.pendingDistribution)} pendente</span>
                  </div>
                </div>

                {/* Per-lawyer breakdown */}
                {Object.keys(distributionSummary.byLawyer).length > 0 && (
                  <div className="space-y-1.5 mt-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Por Advogado</p>
                    {Object.entries(distributionSummary.byLawyer)
                      .sort(([, a], [, b]) => b.total - a.total)
                      .map(([uid, info]) => (
                        <div key={uid} className="flex items-center justify-between bg-muted/40 rounded-md px-3 py-1.5">
                          <span className="text-xs font-medium text-foreground">{info.name}</span>
                          <span className="text-xs font-semibold text-accent">{fmt(info.total)}</span>
                        </div>
                      ))}
                  </div>
                )}

                {/* Orders without distribution */}
                {distributionSummary.ordersWithoutDist.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-amber-600 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> {distributionSummary.ordersWithoutDist.length} sem rateio
                    </p>
                    <div className="space-y-1 mt-1">
                      {distributionSummary.ordersWithoutDist.slice(0, 3).map(o => (
                        <div key={o.id} className="text-xs text-muted-foreground flex justify-between">
                          <span className="truncate max-w-[180px]">{o.process_number || o.beneficiary_name || "Sem identificação"}</span>
                          <span className="font-medium text-foreground">{fmt(Number(o.office_amount))}</span>
                        </div>
                      ))}
                      {distributionSummary.ordersWithoutDist.length > 3 && (
                        <p className="text-[10px] text-muted-foreground">+ {distributionSummary.ordersWithoutDist.length - 3} mais...</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Upcoming payments */}
          {upcomingPayments.length > 0 && (
            <div className="bg-card rounded-lg border shadow-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-accent" /> Próximos Pagamentos Previstos
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground uppercase tracking-wide border-b">
                      <th className="pb-2 pr-4">Tipo</th>
                      <th className="pb-2 pr-4">Processo / Beneficiário</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2 pr-4 text-right">Honorários</th>
                      <th className="pb-2 pr-4">Data Prevista</th>
                      <th className="pb-2 text-right">Prazo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingPayments.map(o => {
                      const config = STATUS_CONFIG[o.status] || STATUS_CONFIG.aguardando;
                      return (
                        <tr key={o.id} className="border-b last:border-0">
                          <td className="py-2.5 pr-4">
                            <Badge variant="outline" className="text-xs">{o.type.toUpperCase()}</Badge>
                          </td>
                          <td className="py-2.5 pr-4 text-foreground text-xs font-medium truncate max-w-[200px]">
                            {o.process_number || o.beneficiary_name || "—"}
                          </td>
                          <td className="py-2.5 pr-4">
                            <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
                          </td>
                          <td className="py-2.5 pr-4 text-right font-semibold text-accent text-xs">{fmt(Number(o.office_amount))}</td>
                          <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                            {o.expected_payment_date ? format(parseISO(o.expected_payment_date), "dd/MM/yyyy") : "—"}
                          </td>
                          <td className="py-2.5 text-right">
                            <Badge variant={o.daysUntil <= 7 ? "destructive" : o.daysUntil <= 30 ? "default" : "secondary"} className="text-xs">
                              {o.daysUntil < 0 ? `${Math.abs(o.daysUntil)}d atrás` : o.daysUntil === 0 ? "Hoje" : `${o.daysUntil}d`}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cash flow bar chart */}
        <div className="bg-card rounded-lg border shadow-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-accent" /> Fluxo de Caixa
          </h2>
          <p className="text-xs text-muted-foreground mb-4">Últimos 6 meses + projeção 3 meses (*)</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="receitas" fill="#10b981" radius={[4, 4, 0, 0]} name="Receitas" />
              <Bar dataKey="despesas" fill="#ef4444" radius={[4, 4, 0, 0]} name="Despesas" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Profit area chart */}
        <div className="bg-card rounded-lg border shadow-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-accent" /> Lucro / Prejuízo Mensal
          </h2>
          <p className="text-xs text-muted-foreground mb-4">Evolução do resultado</p>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="lucro" stroke="hsl(var(--accent))" fill="hsl(var(--accent) / 0.2)" name="Lucro" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue by category pie */}
        <div className="bg-card rounded-lg border shadow-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4 text-emerald-500" /> Receitas por Categoria
          </h2>
          {revenueByCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma receita registrada</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={revenueByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {revenueByCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Expense by category pie */}
        <div className="bg-card rounded-lg border shadow-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <ArrowDownRight className="w-4 h-4 text-red-500" /> Despesas por Categoria
          </h2>
          {expenseByCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma despesa registrada</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={expenseByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {expenseByCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Projections table */}
      <div className="bg-card rounded-lg border shadow-card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-accent" /> Projeções para os Próximos 3 Meses
        </h2>
        <p className="text-xs text-muted-foreground mb-3">Baseado na média dos últimos 6 meses</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wide">
                <th className="pb-2 pr-4">Mês</th>
                <th className="pb-2 pr-4">Receita Estimada</th>
                <th className="pb-2 pr-4">Despesa Estimada</th>
                <th className="pb-2">Lucro Estimado</th>
              </tr>
            </thead>
            <tbody>
              {projections.map((p) => (
                <tr key={p.month} className="border-b last:border-0">
                  <td className="py-2.5 pr-4 font-medium text-foreground capitalize">{p.month}</td>
                  <td className="py-2.5 pr-4 text-emerald-600">{fmt(p.receitas)}</td>
                  <td className="py-2.5 pr-4 text-red-500">{fmt(p.despesas)}</td>
                  <td className={`py-2.5 font-semibold ${p.lucro >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmt(p.lucro)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="bg-card rounded-lg border shadow-card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-accent" /> Transações Recentes
        </h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma transação registrada. Clique em "Nova Transação" para começar.</p>
        ) : (
          <div className="space-y-2">
            {transactions.slice(0, 20).map((tx, i) => (
              <motion.div key={tx.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 p-3 rounded-md bg-muted/50 group">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tx.type === "revenue" ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                  {tx.type === "revenue"
                    ? <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                    : <ArrowDownRight className="w-4 h-4 text-red-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{tx.category}{tx.description ? ` — ${tx.description}` : ""}</p>
                  <p className="text-xs text-muted-foreground">{format(parseISO(tx.date), "dd/MM/yyyy")}{tx.status === "pending" ? " · Pendente" : ""}</p>
                </div>
                <span className={`text-sm font-semibold shrink-0 ${tx.type === "revenue" ? "text-emerald-600" : "text-red-500"}`}>
                  {tx.type === "revenue" ? "+" : "−"}{fmt(Number(tx.amount))}
                </span>
                <button onClick={() => handleDelete(tx.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80">
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* New transaction modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Transação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Button variant={form.type === "revenue" ? "default" : "outline"} onClick={() => setForm({ ...form, type: "revenue", category: "" })} className="gap-1">
                <ArrowUpRight className="w-4 h-4" /> Receita
              </Button>
              <Button variant={form.type === "expense" ? "default" : "outline"} onClick={() => setForm({ ...form, type: "expense", category: "" })} className="gap-1">
                <ArrowDownRight className="w-4 h-4" /> Despesa
              </Button>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Categoria *</label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {(form.type === "revenue" ? REVENUE_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Valor (R$) *</label>
              <Input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0,00" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Data</label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Descrição</label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Opcional" rows={2} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Status</label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">Confirmado</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Cliente</label>
              <Select value={form.client_user_id} onValueChange={(v) => setForm({ ...form, client_user_id: v })}>
                <SelectTrigger><SelectValue placeholder="Nenhum (opcional)" /></SelectTrigger>
                <SelectContent>
                  {clients.map((cl) => (
                    <SelectItem key={cl.user_id} value={cl.user_id}>{cl.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Processo vinculado</label>
              <Select value={form.case_id} onValueChange={(v) => setForm({ ...form, case_id: v })}>
                <SelectTrigger><SelectValue placeholder="Nenhum (opcional)" /></SelectTrigger>
                <SelectContent>
                  {(form.client_user_id ? cases.filter(c => c.client_user_id === form.client_user_id) : cases).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.process_number}{c.subject ? ` — ${c.subject}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!form.category || !form.amount}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
          </div>
        </TabsContent>

        <TabsContent value="rpv-precatorio">
          <Pagamentos />
        </TabsContent>

        <TabsContent value="aguardando-pagamento">
          <PaymentOrdersTracker />
        </TabsContent>

        <TabsContent value="fluxo-caixa">
          <FluxoDeCaixa />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Financeiro;
