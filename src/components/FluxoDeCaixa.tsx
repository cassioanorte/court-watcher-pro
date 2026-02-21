import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import {
  ArrowUpRight, ArrowDownRight, DollarSign, Users, Scale, Calendar,
  TrendingUp, TrendingDown, Wallet, ChevronDown, ChevronRight, Receipt
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, parseISO, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Transaction {
  id: string;
  type: string;
  category: string;
  description: string | null;
  amount: number;
  date: string;
  status: string;
  case_id: string | null;
}

interface PaymentOrder {
  id: string;
  type: string;
  status: string;
  gross_amount: number;
  office_amount: number;
  income_tax: number;
  tax_percent: number;
  process_number: string | null;
  beneficiary_name: string | null;
}

interface FeeDistribution {
  id: string;
  payment_order_id: string;
  lawyer_name: string;
  amount: number;
  paid_at: string | null;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const TAX_CATEGORIES = ["IR sobre Honorários", "INSS", "ISS", "IRPJ/CSLL", "Impostos"];

const FluxoDeCaixa = () => {
  const { tenantId } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [distributions, setDistributions] = useState<FeeDistribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("all");
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    const [txRes, poRes, fdRes] = await Promise.all([
      supabase.from("financial_transactions").select("id, type, category, description, amount, date, status, case_id").eq("tenant_id", tenantId).eq("status", "confirmed").order("date", { ascending: false }),
      supabase.from("payment_orders" as any).select("id, type, status, gross_amount, office_amount, income_tax, tax_percent, process_number, beneficiary_name").eq("tenant_id", tenantId),
      supabase.from("fee_distributions" as any).select("id, payment_order_id, lawyer_name, amount, paid_at").eq("tenant_id", tenantId),
    ]);
    setTransactions((txRes.data || []) as Transaction[]);
    setOrders((poRes.data || []) as unknown as PaymentOrder[]);
    setDistributions((fdRes.data || []) as unknown as FeeDistribution[]);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredTx = useMemo(() => {
    if (period === "all") return transactions;
    const months = parseInt(period);
    const cutoff = subMonths(new Date(), months);
    return transactions.filter(t => parseISO(t.date) >= cutoff);
  }, [transactions, period]);

  // Separate expenses from taxes
  const expenseTx = useMemo(() => filteredTx.filter(t => t.type === "expense" && !TAX_CATEGORIES.includes(t.category)), [filteredTx]);
  const taxTx = useMemo(() => filteredTx.filter(t => t.type === "expense" && TAX_CATEGORIES.includes(t.category)), [filteredTx]);

  const totalRevenue = filteredTx.filter(t => t.type === "revenue").reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = expenseTx.reduce((s, t) => s + Number(t.amount), 0);
  const totalTaxes = taxTx.reduce((s, t) => s + Number(t.amount), 0);
  const totalDistributed = distributions.reduce((s, d) => s + Number(d.amount), 0);
  const netCash = totalRevenue - totalExpense - totalTaxes - totalDistributed;

  const sacadoOrders = orders.filter(o => o.status === "sacado");
  const pendingOrders = orders.filter(o => o.status !== "sacado" && o.status !== "cancelado");

  const rpvTimeline = useMemo(() => {
    return sacadoOrders.map(order => {
      const label = `${order.type.toUpperCase()} — ${order.process_number || order.beneficiary_name || "Sem número"}`;
      const orderDistributions = distributions.filter(d => d.payment_order_id === order.id);
      const totalDist = orderDistributions.reduce((s, d) => s + Number(d.amount), 0);
      const officeGross = Number(order.office_amount) + Number(order.income_tax || 0);
      const ir = Number(order.income_tax) || 0;
      const availableForRateio = Number(order.office_amount) - totalDist;

      return { order, label, officeGross, ir, netOffice: Number(order.office_amount), distributions: orderDistributions, totalDistributed: totalDist, availableForRateio: Math.max(availableForRateio, 0) };
    });
  }, [sacadoOrders, distributions]);

  const monthlySummary = useMemo(() => {
    const months: Record<string, { revenue: number; expense: number; taxes: number; distributed: number }> = {};
    filteredTx.forEach(t => {
      const key = format(parseISO(t.date), "yyyy-MM");
      if (!months[key]) months[key] = { revenue: 0, expense: 0, taxes: 0, distributed: 0 };
      if (t.type === "revenue") months[key].revenue += Number(t.amount);
      if (t.type === "expense") {
        if (TAX_CATEGORIES.includes(t.category)) {
          months[key].taxes += Number(t.amount);
        } else {
          months[key].expense += Number(t.amount);
        }
      }
    });
    distributions.forEach(d => {
      if (d.paid_at) {
        const key = d.paid_at.substring(0, 7);
        if (!months[key]) months[key] = { revenue: 0, expense: 0, taxes: 0, distributed: 0 };
        months[key].distributed += Number(d.amount);
      }
    });
    return Object.entries(months)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, data]) => ({
        month: format(parseISO(month + "-01"), "MMMM/yyyy", { locale: ptBR }),
        ...data,
        net: data.revenue - data.expense - data.taxes - data.distributed,
      }));
  }, [filteredTx, distributions]);

  const expenseBreakdown = useMemo(() => {
    const categories: Record<string, number> = {};
    expenseTx.forEach(t => {
      categories[t.category] = (categories[t.category] || 0) + Number(t.amount);
    });
    return Object.entries(categories).sort(([, a], [, b]) => b - a);
  }, [expenseTx]);

  const taxBreakdown = useMemo(() => {
    const categories: Record<string, number> = {};
    taxTx.forEach(t => {
      categories[t.category] = (categories[t.category] || 0) + Number(t.amount);
    });
    return Object.entries(categories).sort(([, a], [, b]) => b - a);
  }, [taxTx]);

  const toggleExpand = (orderId: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      next.has(orderId) ? next.delete(orderId) : next.add(orderId);
      return next;
    });
  };

  if (loading) return <div className="text-sm text-muted-foreground p-4">Carregando fluxo de caixa...</div>;

  return (
    <div className="space-y-6">
      {/* Period filter */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Wallet className="w-5 h-5 text-primary" /> Fluxo de Caixa
        </h2>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Último mês</SelectItem>
            <SelectItem value="3">Últimos 3 meses</SelectItem>
            <SelectItem value="6">Últimos 6 meses</SelectItem>
            <SelectItem value="12">Último ano</SelectItem>
            <SelectItem value="all">Todo período</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards — now 5 cards including taxes */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Entradas", value: totalRevenue, icon: ArrowUpRight, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Despesas", value: totalExpense, icon: ArrowDownRight, color: "text-red-500", bg: "bg-red-500/10" },
          { label: "Impostos", value: totalTaxes, icon: Receipt, color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "Rateios Pagos", value: totalDistributed, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Saldo de Caixa", value: netCash, icon: Wallet, color: netCash >= 0 ? "text-emerald-500" : "text-red-500", bg: netCash >= 0 ? "bg-emerald-500/10" : "bg-red-500/10" },
        ].map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="bg-card rounded-lg border p-4 shadow-card">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{card.label}</p>
              <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </div>
            <p className={`text-xl font-bold ${card.color}`}>{fmt(card.value)}</p>
          </motion.div>
        ))}
      </div>

      {/* Internal tabs: Despesas / Impostos */}
      <Tabs defaultValue="despesas" className="w-full">
        <TabsList>
          <TabsTrigger value="despesas" className="gap-1.5">
            <ArrowDownRight className="w-4 h-4" /> Despesas
          </TabsTrigger>
          <TabsTrigger value="impostos" className="gap-1.5">
            <Receipt className="w-4 h-4" /> Impostos
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1.5">
            <DollarSign className="w-4 h-4" /> RPVs Sacados
          </TabsTrigger>
          <TabsTrigger value="resumo" className="gap-1.5">
            <Calendar className="w-4 h-4" /> Resumo Mensal
          </TabsTrigger>
        </TabsList>

        {/* ===== DESPESAS TAB ===== */}
        <TabsContent value="despesas">
          <div className="space-y-4">
            {expenseBreakdown.length > 0 ? (
              <div className="bg-card rounded-lg border p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-500" /> Despesas por Categoria
                </h3>
                <div className="space-y-2">
                  {expenseBreakdown.map(([cat, val]) => {
                    const pct = totalExpense > 0 ? (val / totalExpense) * 100 : 0;
                    return (
                      <div key={cat} className="flex items-center gap-3">
                        <span className="text-xs text-foreground w-40 truncate">{cat}</span>
                        <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                          <div className="h-full bg-red-500/60 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-medium text-foreground w-24 text-right">{fmt(val)}</span>
                        <span className="text-[10px] text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 pt-3 border-t flex justify-between text-sm">
                  <span className="font-medium text-muted-foreground">Total Despesas</span>
                  <span className="font-bold text-red-500">{fmt(totalExpense)}</span>
                </div>
              </div>
            ) : (
              <div className="bg-card rounded-lg border p-6 text-center">
                <ArrowDownRight className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma despesa registrada no período</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ===== IMPOSTOS TAB ===== */}
        <TabsContent value="impostos">
          <div className="space-y-4">
            {taxBreakdown.length > 0 ? (
              <div className="bg-card rounded-lg border p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-amber-500" /> Impostos por Categoria
                </h3>
                <div className="space-y-2">
                  {taxBreakdown.map(([cat, val]) => {
                    const pct = totalTaxes > 0 ? (val / totalTaxes) * 100 : 0;
                    return (
                      <div key={cat} className="flex items-center gap-3">
                        <span className="text-xs text-foreground w-40 truncate">{cat}</span>
                        <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                          <div className="h-full bg-amber-500/60 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-medium text-foreground w-24 text-right">{fmt(val)}</span>
                        <span className="text-[10px] text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 pt-3 border-t flex justify-between text-sm">
                  <span className="font-medium text-muted-foreground">Total Impostos</span>
                  <span className="font-bold text-amber-500">{fmt(totalTaxes)}</span>
                </div>
              </div>
            ) : (
              <div className="bg-card rounded-lg border p-6 text-center">
                <Receipt className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum imposto registrado no período</p>
                <p className="text-xs text-muted-foreground mt-1">Impostos são lançados automaticamente ao marcar um RPV como "Sacado"</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ===== TIMELINE RPV TAB ===== */}
        <TabsContent value="timeline">
          <div className="space-y-3">
            {/* Pending RPVs */}
            {pendingOrders.length > 0 && (
              <div className="bg-card rounded-lg border p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-primary" /> RPVs/Precatórios Pendentes
                  <Badge variant="secondary" className="text-xs">{pendingOrders.length}</Badge>
                </h3>
                <div className="text-xs text-muted-foreground">
                  Honorários previstos: <span className="font-semibold text-foreground">{fmt(pendingOrders.reduce((s, o) => s + (Number(o.office_amount) || 0), 0))}</span>
                  {" "}de {fmt(pendingOrders.reduce((s, o) => s + (Number(o.gross_amount) || 0), 0))} bruto
                </div>
              </div>
            )}

            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" /> RPVs/Precatórios Sacados — Detalhamento
            </h3>
            {rpvTimeline.length === 0 ? (
              <div className="bg-card rounded-lg border p-6 text-center">
                <Scale className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum RPV/Precatório sacado ainda</p>
                <p className="text-xs text-muted-foreground mt-1">Ao marcar como "Sacado", os lançamentos serão criados automaticamente</p>
              </div>
            ) : (
              rpvTimeline.map(item => {
                const expanded = expandedOrders.has(item.order.id);
                return (
                  <motion.div key={item.order.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="bg-card rounded-lg border overflow-hidden">
                    <button onClick={() => toggleExpand(item.order.id)}
                      className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors text-left">
                      {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{item.label}</p>
                      </div>
                      <div className="flex items-center gap-4 shrink-0 text-xs">
                        <div className="text-right">
                          <p className="text-muted-foreground">Bruto Honor.</p>
                          <p className="font-medium text-foreground">{fmt(item.officeGross)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-muted-foreground">IR</p>
                          <p className="font-medium text-red-500">−{fmt(item.ir)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-muted-foreground">Líquido</p>
                          <p className="font-bold text-emerald-600">{fmt(item.netOffice)}</p>
                        </div>
                        {item.availableForRateio > 0 && (
                          <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-600">
                            {fmt(item.availableForRateio)} p/ rateio
                          </Badge>
                        )}
                      </div>
                    </button>

                    {expanded && (
                      <div className="border-t px-4 pb-4 pt-3 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-center text-xs">
                          <div className="bg-emerald-500/10 rounded-lg p-2">
                            <p className="text-muted-foreground">Honorários Bruto</p>
                            <p className="font-bold text-emerald-600 text-sm">{fmt(item.officeGross)}</p>
                          </div>
                          <div className="flex items-center justify-center text-muted-foreground font-bold">→</div>
                          <div className="bg-amber-500/10 rounded-lg p-2">
                            <p className="text-muted-foreground">IR ({item.order.tax_percent || 10.9}%)</p>
                            <p className="font-bold text-amber-500 text-sm">−{fmt(item.ir)}</p>
                          </div>
                          <div className="flex items-center justify-center text-muted-foreground font-bold">→</div>
                          <div className="bg-primary/10 rounded-lg p-2">
                            <p className="text-muted-foreground">Líquido</p>
                            <p className="font-bold text-primary text-sm">{fmt(item.netOffice)}</p>
                          </div>
                        </div>

                        {item.distributions.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" /> Rateio entre Advogados
                            </p>
                            <div className="space-y-1">
                              {item.distributions.map(d => (
                                <div key={d.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-muted/30">
                                  <span className="text-foreground font-medium">{d.lawyer_name}</span>
                                  <span className="text-foreground font-semibold">{fmt(Number(d.amount))}</span>
                                </div>
                              ))}
                              <div className="flex justify-between text-xs px-2 pt-1 border-t mt-1">
                                <span className="text-muted-foreground">Total distribuído</span>
                                <span className="font-bold text-foreground">{fmt(item.totalDistributed)}</span>
                              </div>
                              {item.availableForRateio > 0 && (
                                <div className="flex justify-between text-xs px-2">
                                  <span className="text-amber-600">Saldo disponível p/ rateio</span>
                                  <span className="font-bold text-amber-600">{fmt(item.availableForRateio)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        {item.distributions.length === 0 && (
                          <p className="text-xs text-muted-foreground italic">Nenhum rateio registrado para este RPV</p>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* ===== RESUMO MENSAL TAB ===== */}
        <TabsContent value="resumo">
          {monthlySummary.length > 0 ? (
            <div className="bg-card rounded-lg border overflow-hidden">
              <div className="p-4 border-b">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" /> Resumo Mensal
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground uppercase tracking-wide border-b">
                      <th className="p-3 text-left">Mês</th>
                      <th className="p-3 text-right">Entradas</th>
                      <th className="p-3 text-right">Despesas</th>
                      <th className="p-3 text-right">Impostos</th>
                      <th className="p-3 text-right">Rateios</th>
                      <th className="p-3 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlySummary.map(m => (
                      <tr key={m.month} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-3 font-medium text-foreground capitalize">{m.month}</td>
                        <td className="p-3 text-right text-emerald-600">{fmt(m.revenue)}</td>
                        <td className="p-3 text-right text-red-500">{fmt(m.expense)}</td>
                        <td className="p-3 text-right text-amber-500">{fmt(m.taxes)}</td>
                        <td className="p-3 text-right text-blue-500">{fmt(m.distributed)}</td>
                        <td className={`p-3 text-right font-bold ${m.net >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmt(m.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-card rounded-lg border p-6 text-center">
              <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum dado disponível para o período selecionado</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FluxoDeCaixa;
