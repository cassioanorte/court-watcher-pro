import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Plus, Trash2, Pencil, AlertTriangle, CheckCircle2, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format, parseISO, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface BillingItem {
  id: string;
  client_user_id: string;
  case_id: string | null;
  amount: number;
  due_date: string;
  description: string | null;
  status: string;
  notes: string | null;
}

interface ClientOption {
  user_id: string;
  full_name: string;
}

interface CaseOption {
  id: string;
  process_number: string;
  subject: string | null;
  client_user_id: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Pendente", color: "bg-yellow-500/10 text-yellow-600", icon: Clock },
  overdue: { label: "Vencido", color: "bg-red-500/10 text-red-600", icon: AlertTriangle },
  partial: { label: "Parcial", color: "bg-blue-500/10 text-blue-600", icon: Clock },
  paid: { label: "Pago", color: "bg-emerald-500/10 text-emerald-600", icon: CheckCircle2 },
  cancelled: { label: "Cancelado", color: "bg-muted text-muted-foreground", icon: X },
};

const Cobranca = () => {
  const { tenantId, user } = useAuth();
  const [items, setItems] = useState<BillingItem[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  const emptyForm = {
    client_user_id: "",
    case_id: "",
    amount: "",
    due_date: format(new Date(), "yyyy-MM-dd"),
    description: "",
    status: "pending",
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      const [billRes, casesRes, profilesRes] = await Promise.all([
        supabase.from("billing_collections").select("id, client_user_id, case_id, amount, due_date, description, status, notes").eq("tenant_id", tenantId).order("due_date", { ascending: true }),
        supabase.from("cases").select("id, process_number, subject, client_user_id").eq("tenant_id", tenantId),
        supabase.from("profiles").select("user_id, full_name").eq("tenant_id", tenantId),
      ]);
      setItems((billRes.data as BillingItem[]) || []);
      setCases(casesRes.data || []);
      const allProfiles = profilesRes.data || [];
      const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("user_id", allProfiles.map(p => p.user_id));
      const clientIds = new Set((roles || []).filter(r => r.role === "client").map(r => r.user_id));
      setClients(allProfiles.filter(p => clientIds.has(p.user_id)).sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR")));
      setLoading(false);
    };
    load();
  }, [tenantId]);

  const clientName = (uid: string) => clients.find(c => c.user_id === uid)?.full_name || "—";

  const handleSave = async () => {
    if (!form.client_user_id || !form.amount || !tenantId || !user?.id) return;
    const payload = {
      tenant_id: tenantId,
      created_by: user.id,
      client_user_id: form.client_user_id,
      case_id: form.case_id || null,
      amount: parseFloat(form.amount),
      due_date: form.due_date,
      description: form.description || null,
      status: form.status,
      notes: form.notes || null,
    };

    if (editingId) {
      const { error } = await supabase.from("billing_collections").update(payload as any).eq("id", editingId);
      if (error) { toast.error("Erro ao atualizar"); return; }
      setItems(prev => prev.map(i => i.id === editingId ? { ...i, ...payload, amount: parseFloat(form.amount) } as BillingItem : i));
      toast.success("Cobrança atualizada!");
    } else {
      const { data, error } = await supabase.from("billing_collections").insert(payload as any).select().single();
      if (error) { toast.error("Erro ao criar cobrança"); return; }
      setItems(prev => [...prev, data as BillingItem]);
      toast.success("Cobrança registrada!");
    }
    closeModal();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("billing_collections").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    setItems(prev => prev.filter(i => i.id !== id));
    toast.success("Cobrança removida");
  };

  const openEdit = (item: BillingItem) => {
    setEditingId(item.id);
    setForm({
      client_user_id: item.client_user_id,
      case_id: item.case_id || "",
      amount: String(item.amount),
      due_date: item.due_date,
      description: item.description || "",
      status: item.status,
      notes: item.notes || "",
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const getEffectiveStatus = (item: BillingItem) => {
    if (item.status === "paid" || item.status === "cancelled") return item.status;
    if (isPast(parseISO(item.due_date)) && !isToday(parseISO(item.due_date))) return "overdue";
    return item.status;
  };

  const filtered = items.filter(i => {
    if (filter === "all") return true;
    return getEffectiveStatus(i) === filter;
  });

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const totalOverdue = items.filter(i => getEffectiveStatus(i) === "overdue").reduce((s, i) => s + Number(i.amount), 0);
  const totalPending = items.filter(i => getEffectiveStatus(i) === "pending" || getEffectiveStatus(i) === "partial").reduce((s, i) => s + Number(i.amount), 0);
  const totalPaid = items.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);

  if (loading) return <div className="text-muted-foreground text-sm p-4">Carregando...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cobrança</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie cobranças e pagamentos em atraso</p>
        </div>
        <Button onClick={() => setShowModal(true)} className="gap-1">
          <Plus className="w-4 h-4" /> Nova Cobrança
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Vencido", value: fmt(totalOverdue), color: "text-red-500", bg: "bg-red-500/10", icon: AlertTriangle },
          { label: "Pendente", value: fmt(totalPending), color: "text-yellow-600", bg: "bg-yellow-500/10", icon: Clock },
          { label: "Recebido", value: fmt(totalPaid), color: "text-emerald-600", bg: "bg-emerald-500/10", icon: CheckCircle2 },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="bg-card rounded-lg p-5 shadow-card border">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                <p className="text-xl font-bold text-foreground mt-1 font-display">{kpi.value}</p>
              </div>
              <div className={`w-10 h-10 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "all", label: "Todos" },
          { key: "overdue", label: "Vencidos" },
          { key: "pending", label: "Pendentes" },
          { key: "partial", label: "Parciais" },
          { key: "paid", label: "Pagos" },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              filter === f.key ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}>
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-card rounded-lg border p-8 text-center shadow-card">
          <p className="text-sm text-muted-foreground">
            {items.length === 0 ? "Nenhuma cobrança registrada. Clique em 'Nova Cobrança' para começar." : "Nenhum resultado para este filtro."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item, i) => {
            const effectiveStatus = getEffectiveStatus(item);
            const cfg = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.pending;
            const StatusIcon = cfg.icon;
            return (
              <motion.div key={item.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                className="bg-card rounded-lg border p-4 shadow-card hover:shadow-card-hover transition-shadow group">
                <div className="flex items-center gap-4">
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", cfg.color.split(" ")[0])}>
                    <StatusIcon className={cn("w-4 h-4", cfg.color.split(" ")[1])} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground">{clientName(item.client_user_id)}</p>
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", cfg.color)}>{cfg.label}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span>Vencimento: {format(parseISO(item.due_date), "dd/MM/yyyy")}</span>
                      {item.description && <span>· {item.description}</span>}
                    </div>
                  </div>
                  <span className="text-sm font-bold text-foreground shrink-0">{fmt(Number(item.amount))}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(item)} className="text-muted-foreground hover:text-foreground">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="text-destructive hover:text-destructive/80">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {item.notes && (
                  <p className="text-xs text-muted-foreground mt-2 ml-13 pl-13 border-l-2 border-muted pl-3">{item.notes}</p>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={(o) => { if (!o) closeModal(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Cobrança" : "Nova Cobrança"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Cliente *</label>
              <Select value={form.client_user_id} onValueChange={(v) => setForm({ ...form, client_user_id: v, case_id: "" })}>
                <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.user_id} value={c.user_id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Processo vinculado</label>
              <Select value={form.case_id} onValueChange={(v) => setForm({ ...form, case_id: v })}>
                <SelectTrigger><SelectValue placeholder="Nenhum (opcional)" /></SelectTrigger>
                <SelectContent>
                  {(form.client_user_id ? cases.filter(c => c.client_user_id === form.client_user_id) : cases).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.process_number}{c.subject ? ` — ${c.subject}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Valor (R$) *</label>
              <Input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0,00" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Data de vencimento *</label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Descrição</label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex: Honorários advocatícios" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Status</label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="partial">Parcial</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Observações</label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Anotações internas sobre a cobrança" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.client_user_id || !form.amount}>{editingId ? "Salvar" : "Registrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Cobranca;
