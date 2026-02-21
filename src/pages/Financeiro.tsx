import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  DollarSign, TrendingUp, TrendingDown, PiggyBank, Plus, Trash2, X, Save,
  ArrowUpRight, ArrowDownRight, BarChart3, Target, Calendar, Banknote
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Pagamentos from "@/pages/Pagamentos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend
} from "recharts";
import { format, startOfMonth, endOfMonth, subMonths, addMonths, parseISO } from "date-fns";
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

const REVENUE_CATEGORIES = ["Honorários", "Consultoria", "Acordo", "Êxito", "Outros"];
const EXPENSE_CATEGORIES = ["Aluguel", "Salários", "Impostos", "Material", "Tecnologia", "Marketing", "Custas Processuais", "Outros"];
const PIE_COLORS = ["hsl(var(--accent))", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#6b7280"];

const Financeiro = () => {
  const { tenantId, user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
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
      const [txRes, casesRes, profilesRes] = await Promise.all([
        supabase.from("financial_transactions").select("id, type, category, description, amount, date, status, case_id").eq("tenant_id", tenantId).order("date", { ascending: false }),
        supabase.from("cases").select("id, process_number, subject, client_user_id").eq("tenant_id", tenantId),
        supabase.from("profiles").select("user_id, full_name").eq("tenant_id", tenantId),
      ]);
      setTransactions((txRes.data as Transaction[]) || []);
      setCases(casesRes.data || []);
      // Filter only clients by checking user_roles
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
  const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

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

  // Projections: simple average-based for next 3 months
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

  // Expense breakdown by category
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

  const kpis = [
    { label: "Receitas", value: fmt(totalRevenue), icon: TrendingUp, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
    { label: "Despesas", value: fmt(totalExpense), icon: TrendingDown, color: "text-red-500", bgColor: "bg-red-500/10" },
    { label: "Lucro Líquido", value: fmt(profit), icon: PiggyBank, color: profit >= 0 ? "text-emerald-500" : "text-red-500", bgColor: profit >= 0 ? "bg-emerald-500/10" : "bg-red-500/10" },
    { label: "Margem de Lucro", value: `${profitMargin.toFixed(1)}%`, icon: Target, color: "text-accent", bgColor: "bg-accent/10" },
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
        </TabsList>

        <TabsContent value="visao-geral">
          <div className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={() => setShowModal(true)} className="gap-1">
                <Plus className="w-4 h-4" /> Nova Transação
              </Button>
            </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="bg-card rounded-lg p-5 shadow-card border">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                <p className="text-xl font-bold text-foreground mt-1 font-display">{kpi.value}</p>
              </div>
              <div className={`w-10 h-10 rounded-lg ${kpi.bgColor} flex items-center justify-center`}>
                <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

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
      </Tabs>
    </div>
  );
};

export default Financeiro;
