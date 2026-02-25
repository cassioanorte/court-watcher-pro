import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Plus, Trash2, Pencil, AlertTriangle, CheckCircle2, Clock, X, FileText, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format, parseISO, isPast, isToday, addMonths } from "date-fns";
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
  const [showAgreementModal, setShowAgreementModal] = useState(false);
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

  // Agreement form state
  const [agreementForm, setAgreementForm] = useState({
    client_user_id: "",
    case_id: "",
    num_installments: "12",
    start_date: format(new Date(), "yyyy-MM-dd"),
    day_of_month: "10",
    description: "",
    notify_client: true,
    create_reminders: true,
  });
  const [installmentAmounts, setInstallmentAmounts] = useState<string[]>([]);
  const [savingAgreement, setSavingAgreement] = useState(false);

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

  // ===== AGREEMENT LOGIC =====
  const openAgreementModal = () => {
    setAgreementForm({
      client_user_id: "",
      case_id: "",
      num_installments: "12",
      start_date: format(new Date(), "yyyy-MM-dd"),
      day_of_month: "10",
      description: "",
      notify_client: true,
      create_reminders: true,
    });
    setInstallmentAmounts([]);
    setShowAgreementModal(true);
  };

  const handleInstallmentCountChange = (count: string) => {
    const n = Math.min(Math.max(parseInt(count) || 1, 1), 120);
    setAgreementForm(f => ({ ...f, num_installments: String(n) }));
    setInstallmentAmounts(prev => {
      const arr = [...prev];
      while (arr.length < n) arr.push("");
      return arr.slice(0, n);
    });
  };

  const setAllSameAmount = (val: string) => {
    const n = parseInt(agreementForm.num_installments) || 1;
    setInstallmentAmounts(Array(n).fill(val));
  };

  const handleSaveAgreement = async () => {
    if (!agreementForm.client_user_id || !tenantId || !user?.id) return;
    const n = parseInt(agreementForm.num_installments) || 1;
    const dayOfMonth = parseInt(agreementForm.day_of_month) || 10;
    const clientFullName = clientName(agreementForm.client_user_id);
    const desc = agreementForm.description || "Acordo parcelado";

    // Validate all amounts
    const amounts = installmentAmounts.map(a => parseFloat(a));
    if (amounts.some(a => !a || a <= 0)) {
      toast.error("Preencha todos os valores das parcelas");
      return;
    }

    setSavingAgreement(true);

    try {
      const startDate = parseISO(agreementForm.start_date);
      const billingEntries: any[] = [];
      const notificationEntries: any[] = [];
      const reminderEntries: any[] = [];

      for (let i = 0; i < n; i++) {
        const dueDate = addMonths(startDate, i);
        // Set day of month, clamping to last day if needed
        const year = dueDate.getFullYear();
        const month = dueDate.getMonth();
        const lastDay = new Date(year, month + 1, 0).getDate();
        const day = Math.min(dayOfMonth, lastDay);
        const dueDateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

        billingEntries.push({
          tenant_id: tenantId,
          created_by: user.id,
          client_user_id: agreementForm.client_user_id,
          case_id: agreementForm.case_id || null,
          amount: amounts[i],
          due_date: dueDateStr,
          description: `${desc} — Parcela ${i + 1}/${n}`,
          status: "pending",
          notes: `Acordo parcelado: ${n}x, dia ${dayOfMonth} de cada mês`,
        });

        // Client notification
        if (agreementForm.notify_client) {
          notificationEntries.push({
            tenant_id: tenantId,
            client_user_id: agreementForm.client_user_id,
            sent_by: user.id,
            type: "billing",
            title: `Lembrete de pagamento — Parcela ${i + 1}/${n}`,
            body: `Olá ${clientFullName}, este é um lembrete de que a parcela ${i + 1}/${n} do seu acordo no valor de ${fmt(amounts[i])} vence em ${format(parseISO(dueDateStr), "dd/MM/yyyy")}. Por favor, efetue o pagamento até a data de vencimento.`,
          });
        }

        // Internal reminder
        if (agreementForm.create_reminders) {
          // Create reminder 3 days before due date
          const reminderDate = new Date(year, month, day - 3);
          const reminderDateStr = format(reminderDate > new Date() ? reminderDate : new Date(), "yyyy-MM-dd");
          reminderEntries.push({
            tenant_id: tenantId,
            created_by: user.id,
            assigned_to: user.id,
            title: `Verificar pagamento — ${clientFullName} — Parcela ${i + 1}/${n}`,
            description: `${desc}: parcela ${i + 1}/${n} de ${fmt(amounts[i])} vence em ${format(parseISO(dueDateStr), "dd/MM/yyyy")}`,
            due_date: reminderDateStr,
            category: "cobranca",
            client_user_id: agreementForm.client_user_id,
            case_id: agreementForm.case_id || null,
          });
        }
      }

      // Insert billing collections
      const { data: newBillings, error: billErr } = await supabase
        .from("billing_collections")
        .insert(billingEntries)
        .select();
      if (billErr) throw billErr;

      // Insert notifications
      if (notificationEntries.length > 0) {
        const { error: notifErr } = await supabase
          .from("client_notifications")
          .insert(notificationEntries);
        if (notifErr) console.error("Notification error:", notifErr);
      }

      // Insert reminders
      if (reminderEntries.length > 0) {
        const { error: remErr } = await supabase
          .from("reminders")
          .insert(reminderEntries);
        if (remErr) console.error("Reminder error:", remErr);
      }

      setItems(prev => [...prev, ...(newBillings as BillingItem[] || [])]);
      setShowAgreementModal(false);
      toast.success(`Acordo cadastrado! ${n} parcelas criadas com ${agreementForm.notify_client ? "notificações" : ""} ${agreementForm.create_reminders ? "e lembretes" : ""}`);
    } catch (err: any) {
      toast.error("Erro ao criar acordo: " + (err.message || "erro desconhecido"));
    } finally {
      setSavingAgreement(false);
    }
  };

  if (loading) return <div className="text-muted-foreground text-sm p-4">Carregando...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cobrança</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie cobranças e pagamentos em atraso</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openAgreementModal} className="gap-1">
            <FileText className="w-4 h-4" /> Novo Acordo
          </Button>
          <Button onClick={() => setShowModal(true)} className="gap-1">
            <Plus className="w-4 h-4" /> Nova Cobrança
          </Button>
        </div>
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

      {/* Single billing modal */}
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

      {/* ===== AGREEMENT MODAL ===== */}
      <Dialog open={showAgreementModal} onOpenChange={(o) => { if (!o) setShowAgreementModal(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Novo Acordo Parcelado
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Client */}
            <div>
              <label className="text-sm font-medium text-foreground">Cliente *</label>
              <Select value={agreementForm.client_user_id} onValueChange={(v) => setAgreementForm(f => ({ ...f, client_user_id: v, case_id: "" }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.user_id} value={c.user_id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Case */}
            <div>
              <label className="text-sm font-medium text-foreground">Processo vinculado</label>
              <Select value={agreementForm.case_id} onValueChange={(v) => setAgreementForm(f => ({ ...f, case_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Nenhum (opcional)" /></SelectTrigger>
                <SelectContent>
                  {(agreementForm.client_user_id ? cases.filter(c => c.client_user_id === agreementForm.client_user_id) : cases).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.process_number}{c.subject ? ` — ${c.subject}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-medium text-foreground">Descrição do acordo</label>
              <Input value={agreementForm.description} onChange={(e) => setAgreementForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Acordo trabalhista, Acordo alimentar..." />
            </div>

            <div className="grid grid-cols-3 gap-3">
              {/* Num installments */}
              <div>
                <label className="text-sm font-medium text-foreground">Nº de parcelas *</label>
                <Input type="number" min="1" max="120" value={agreementForm.num_installments}
                  onChange={(e) => handleInstallmentCountChange(e.target.value)} />
              </div>
              {/* Day of month */}
              <div>
                <label className="text-sm font-medium text-foreground">Dia do vencimento *</label>
                <Input type="number" min="1" max="31" value={agreementForm.day_of_month}
                  onChange={(e) => setAgreementForm(f => ({ ...f, day_of_month: e.target.value }))} />
              </div>
              {/* Start date */}
              <div>
                <label className="text-sm font-medium text-foreground">Início *</label>
                <Input type="date" value={agreementForm.start_date}
                  onChange={(e) => setAgreementForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
            </div>

            {/* Options */}
            <div className="flex gap-6 items-center">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={agreementForm.notify_client}
                  onChange={(e) => setAgreementForm(f => ({ ...f, notify_client: e.target.checked }))}
                  className="rounded border-input" />
                Notificar cliente
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={agreementForm.create_reminders}
                  onChange={(e) => setAgreementForm(f => ({ ...f, create_reminders: e.target.checked }))}
                  className="rounded border-input" />
                Criar lembretes internos
              </label>
            </div>

            {/* Installment amounts */}
            {parseInt(agreementForm.num_installments) > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-foreground">Valores das Parcelas</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Valor igual para todas:</span>
                    <Input type="number" step="0.01" placeholder="R$ 0,00" className="w-28 h-7 text-xs"
                      onChange={(e) => setAllSameAmount(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-60 overflow-y-auto p-1">
                  {installmentAmounts.map((amt, idx) => {
                    const startDate = parseISO(agreementForm.start_date);
                    const dueDate = addMonths(startDate, idx);
                    const dayOfMonth = parseInt(agreementForm.day_of_month) || 10;
                    const lastDay = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0).getDate();
                    const day = Math.min(dayOfMonth, lastDay);
                    const dateLabel = `${String(day).padStart(2, "0")}/${String(dueDate.getMonth() + 1).padStart(2, "0")}/${dueDate.getFullYear()}`;

                    return (
                      <div key={idx} className="border rounded-lg p-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-muted-foreground">Parcela {idx + 1}</span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <CalendarDays className="w-3 h-3" /> {dateLabel}
                          </span>
                        </div>
                        <Input type="number" step="0.01" min="0" placeholder="R$ 0,00"
                          value={amt} onChange={(e) => {
                            const arr = [...installmentAmounts];
                            arr[idx] = e.target.value;
                            setInstallmentAmounts(arr);
                          }}
                          className="h-7 text-xs" />
                      </div>
                    );
                  })}
                </div>
                {installmentAmounts.some(a => parseFloat(a) > 0) && (
                  <div className="flex justify-between text-sm border-t pt-2">
                    <span className="text-muted-foreground">Total do acordo:</span>
                    <span className="font-bold text-foreground">
                      {fmt(installmentAmounts.reduce((s, a) => s + (parseFloat(a) || 0), 0))}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAgreementModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveAgreement}
              disabled={!agreementForm.client_user_id || savingAgreement || installmentAmounts.length === 0}
              className="gap-1">
              {savingAgreement ? "Salvando..." : "Criar Acordo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Cobranca;
