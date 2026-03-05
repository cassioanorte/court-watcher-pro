import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Bell, Plus, Check, Trash2, UserCircle, Briefcase, Users, X, CalendarDays, Clock, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface Reminder {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  category: string;
  case_id: string | null;
  client_user_id: string | null;
  tagged_user_id: string | null;
  completed: boolean;
  completed_at: string | null;
  created_by: string;
  assigned_to: string;
  created_at: string;
}

interface StaffMember {
  user_id: string;
  full_name: string;
}

interface CaseOption {
  id: string;
  process_number: string;
  parties: string | null;
}

interface ClientOption {
  user_id: string;
  full_name: string;
}

const CATEGORIES = [
  { value: "pessoal", label: "Pessoal", icon: "🏠" },
  { value: "processo", label: "Processo", icon: "⚖️" },
  { value: "cliente", label: "Cliente", icon: "👤" },
  { value: "reuniao", label: "Reunião", icon: "📅" },
  { value: "prazo", label: "Prazo", icon: "⏰" },
  { value: "saude", label: "Saúde", icon: "💪" },
  { value: "financeiro", label: "Financeiro", icon: "💰" },
  { value: "outro", label: "Outro", icon: "📌" },
];

const DashboardReminders = () => {
  const { user, tenantId } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [category, setCategory] = useState("pessoal");
  const [assignedTo, setAssignedTo] = useState("");
  const [caseId, setCaseId] = useState("");
  const [clientUserId, setClientUserId] = useState("");
  const [taggedUserId, setTaggedUserId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Options
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);

  const fetchReminders = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("reminders" as any)
      .select("*")
      .eq("assigned_to", user.id)
      .order("completed", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(50);
    setReminders((data || []) as unknown as Reminder[]);
    setLoading(false);
  }, [user?.id]);

  const fetchOptions = useCallback(async () => {
    if (!tenantId) return;
    const [staffRes, casesRes, clientsRes] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name").eq("tenant_id", tenantId),
      supabase.from("cases").select("id, process_number, parties").eq("tenant_id", tenantId).eq("archived", false).order("process_number").limit(100),
      supabase.from("profiles").select("user_id, full_name").eq("tenant_id", tenantId),
    ]);

    // Filter staff (owners + staff roles)
    if (staffRes.data) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", staffRes.data.map(p => p.user_id));
      const staffIds = new Set((roles || []).filter(r => r.role === "owner" || r.role === "staff").map(r => r.user_id));
      setStaffMembers(staffRes.data.filter(p => staffIds.has(p.user_id)));

      const clientIds = new Set((roles || []).filter(r => r.role === "client").map(r => r.user_id));
      setClients((clientsRes.data || []).filter(p => clientIds.has(p.user_id)));
    }
    setCases((casesRes.data || []) as CaseOption[]);
  }, [tenantId]);

  useEffect(() => {
    fetchReminders();
    fetchOptions();
  }, [fetchReminders, fetchOptions]);

  // Realtime
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`reminders-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reminders" }, () => {
        fetchReminders();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, fetchReminders]);

  const handleSubmit = async () => {
    if (!title.trim() || !user?.id || !tenantId) return;
    setSubmitting(true);
    const target = assignedTo || user.id;
    const { error } = await supabase.from("reminders" as any).insert({
      tenant_id: tenantId,
      created_by: user.id,
      assigned_to: target,
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate || null,
      due_time: dueTime || null,
      category,
      case_id: caseId || null,
      client_user_id: clientUserId || null,
      tagged_user_id: taggedUserId || null,
    });
    if (error) {
      toast.error("Erro ao criar lembrete");
    } else {
      toast.success("Lembrete criado!");
      resetForm();
      fetchReminders();
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDueDate("");
    setDueTime("");
    setCategory("pessoal");
    setAssignedTo("");
    setCaseId("");
    setClientUserId("");
    setTaggedUserId("");
    setShowForm(false);
  };

  const toggleComplete = async (reminder: Reminder) => {
    const newCompleted = !reminder.completed;
    await supabase.from("reminders" as any).update({
      completed: newCompleted,
      completed_at: newCompleted ? new Date().toISOString() : null,
    }).eq("id", reminder.id);
    setReminders(prev =>
      prev.map(r => r.id === reminder.id ? { ...r, completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null } : r)
    );
  };

  const deleteReminder = async (id: string) => {
    await supabase.from("reminders" as any).delete().eq("id", id);
    setReminders(prev => prev.filter(r => r.id !== id));
    toast.success("Lembrete excluído");
  };

  const getCategoryInfo = (cat: string) => CATEGORIES.find(c => c.value === cat) || CATEGORIES[CATEGORIES.length - 1];
  const getStaffName = (uid: string) => staffMembers.find(s => s.user_id === uid)?.full_name || "";
  const getCase = (cid: string) => cases.find(c => c.id === cid);
  const getCaseLabel = (cid: string) => getCase(cid)?.process_number || "";
  const getClientName = (uid: string) => clients.find(c => c.user_id === uid)?.full_name || "";

  const activeReminders = reminders.filter(r => !r.completed);
  const completedReminders = reminders.filter(r => r.completed);
  const isOverdue = (r: Reminder) => r.due_date && !r.completed && new Date(r.due_date + "T23:59:59") < new Date();

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card rounded-xl border shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-accent" />
          <h2 className="font-semibold text-foreground">Lembretes</h2>
          {activeReminders.length > 0 && (
            <Badge variant="default" className="text-xs">{activeReminders.length}</Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" /> Novo
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
      ) : activeReminders.length === 0 && !showCompleted ? (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhum lembrete ativo 🎉</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {activeReminders.map((r) => {
            const catInfo = getCategoryInfo(r.category);
            const overdue = isOverdue(r);
            return (
              <div
                key={r.id}
                className={`flex items-start gap-2 rounded-lg border p-3 transition-all ${overdue ? "border-l-4 border-l-destructive bg-destructive/5" : ""}`}
              >
                <button onClick={() => toggleComplete(r)} className="mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 border-muted-foreground/40 hover:border-accent flex items-center justify-center transition-colors">
                  {r.completed && <Check className="w-3 h-3 text-accent" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs">{catInfo.icon}</span>
                    <p className="text-sm text-foreground font-medium line-clamp-1">{r.title}</p>
                  </div>
                  {r.description && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{r.description}</p>}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {r.due_date && (
                      <span className={`text-[10px] flex items-center gap-0.5 ${overdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                        <CalendarDays className="w-3 h-3" />
                        {new Date(r.due_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                        {r.due_time && ` ${r.due_time.slice(0, 5)}`}
                      </span>
                    )}
                    {r.assigned_to !== r.created_by && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <UserCircle className="w-3 h-3" />
                        {r.assigned_to === user?.id ? "Para mim" : getStaffName(r.assigned_to)}
                      </span>
                    )}
                    {r.case_id && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Briefcase className="w-3 h-3" />
                        {getCaseLabel(r.case_id)}
                      </span>
                    )}
                    {r.client_user_id && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Users className="w-3 h-3" />
                        {getClientName(r.client_user_id)}
                      </span>
                    )}
                    {r.tagged_user_id && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Tag className="w-3 h-3" />
                        {getStaffName(r.tagged_user_id)}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => deleteReminder(r.id)} className="p-1 text-muted-foreground hover:text-destructive shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {completedReminders.length > 0 && (
        <div className="mt-3">
          <button onClick={() => setShowCompleted(!showCompleted)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            {showCompleted ? "Ocultar" : "Mostrar"} concluídos ({completedReminders.length})
          </button>
          {showCompleted && (
            <div className="space-y-1.5 mt-2">
              {completedReminders.map((r) => (
                <div key={r.id} className="flex items-center gap-2 rounded-lg border p-2 opacity-60">
                  <button onClick={() => toggleComplete(r)} className="shrink-0 w-5 h-5 rounded-full border-2 border-accent bg-accent/20 flex items-center justify-center">
                    <Check className="w-3 h-3 text-accent" />
                  </button>
                  <p className="text-xs text-muted-foreground line-through flex-1 line-clamp-1">{r.title}</p>
                  <button onClick={() => deleteReminder(r.id)} className="p-1 text-muted-foreground hover:text-destructive shrink-0">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* New Reminder Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Lembrete</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input placeholder="Título do lembrete *" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea placeholder="Descrição (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Data</label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Hora</label>
                <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Categoria</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Atribuir para</label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger><SelectValue placeholder="Eu mesmo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={user?.id || ""}>Eu mesmo</SelectItem>
                  {staffMembers.filter(s => s.user_id !== user?.id).map(s => (
                    <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Marcar pessoa</label>
              <Select value={taggedUserId} onValueChange={setTaggedUserId}>
                <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {staffMembers.map(s => (
                    <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Vincular processo</label>
              <Select value={caseId} onValueChange={setCaseId}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {cases.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.process_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Vincular cliente</label>
              <Select value={clientUserId} onValueChange={setClientUserId}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {clients.map(c => (
                    <SelectItem key={c.user_id} value={c.user_id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={resetForm}>Cancelar</Button>
              <Button size="sm" onClick={handleSubmit} disabled={!title.trim() || submitting}>
                {submitting ? "Criando..." : "Criar Lembrete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default DashboardReminders;
