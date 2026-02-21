import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Clock, CheckCircle2, AlertTriangle, Search, Filter, Banknote } from "lucide-react";

interface PaymentOrder {
  id: string;
  type: string;
  status: string;
  gross_amount: number;
  office_amount: number;
  client_amount: number;
  beneficiary_name: string | null;
  process_number: string | null;
  case_id: string | null;
  expected_payment_date: string | null;
  created_at: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  aguardando: { label: "Aguardando", color: "bg-amber-500/10 text-amber-600 border-amber-500/30", icon: Clock },
  liberado: { label: "Liberado", color: "bg-blue-500/10 text-blue-600 border-blue-500/30", icon: CheckCircle2 },
  sacado: { label: "Sacado", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", icon: CheckCircle2 },
  cancelado: { label: "Cancelado", color: "bg-destructive/10 text-destructive border-destructive/30", icon: AlertTriangle },
};

const PaymentOrdersTracker = () => {
  const { tenantId } = useAuth();
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const fetchOrders = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from("payment_orders" as any)
      .select("id, type, status, gross_amount, office_amount, client_amount, beneficiary_name, process_number, case_id, expected_payment_date, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    setOrders((data || []) as unknown as PaymentOrder[]);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const togglePaid = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "sacado" ? "aguardando" : "sacado";
    const { error } = await supabase.from("payment_orders" as any).update({ status: newStatus }).eq("id", id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
    toast.success(newStatus === "sacado" ? "Marcado como pago" : "Marcado como pendente");
  };

  const updateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.from("payment_orders" as any).update({ status: newStatus }).eq("id", id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
    toast.success("Status atualizado");
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
                        <Checkbox
                          checked={isPaid}
                          onCheckedChange={() => togglePaid(o.id, o.status)}
                        />
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs uppercase">{o.type}</Badge>
                      </td>
                      <td className={`p-3 font-medium ${isPaid ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {o.beneficiary_name || "—"}
                      </td>
                      <td className="p-3 text-muted-foreground font-mono text-xs">{o.process_number || "—"}</td>
                      <td className={`p-3 text-right ${isPaid ? "text-muted-foreground" : "text-foreground"}`}>{fmt(o.gross_amount)}</td>
                      <td className={`p-3 text-right font-medium ${isPaid ? "text-muted-foreground" : "text-accent"}`}>{fmt(o.office_amount)}</td>
                      <td className={`p-3 text-right ${isPaid ? "text-muted-foreground" : "text-foreground"}`}>{fmt(o.client_amount)}</td>
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
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentOrdersTracker;
