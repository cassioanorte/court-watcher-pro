import { useState, useEffect, useCallback } from "react";
import { Bell, Plus, Trash2, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface ScheduledNotification {
  id: string;
  client_user_id: string;
  case_id: string | null;
  title: string;
  message: string;
  email_override: string | null;
  start_date: string;
  day_of_month: number;
  repeat_count: number;
  sent_count: number;
  next_send_date: string;
  channel: string;
  is_active: boolean;
}

interface ClientOption {
  user_id: string;
  full_name: string;
  email: string | null;
}

interface CaseOption {
  id: string;
  process_number: string;
}

const DashboardNotificador = () => {
  const { tenantId, user } = useAuth();
  const userId = user?.id;
  const [notifications, setNotifications] = useState<ScheduledNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [cases, setCases] = useState<CaseOption[]>([]);

  // form state
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedCase, setSelectedCase] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [emailOverride, setEmailOverride] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState(10);
  const [repeatCount, setRepeatCount] = useState(3);
  const [channel, setChannel] = useState("all");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });
  const [saving, setSaving] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from("scheduled_notifications")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("next_send_date", { ascending: true })
      .limit(20);
    setNotifications((data || []) as ScheduledNotification[]);
    setLoading(false);
  }, [tenantId]);

  const fetchClientsAndCases = useCallback(async () => {
    if (!tenantId) return;
    const [clientsRes, casesRes] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, email").eq("tenant_id", tenantId).order("full_name"),
      supabase.from("cases").select("id, process_number").eq("tenant_id", tenantId).eq("archived", false).order("process_number").limit(200),
    ]);
    setClients((clientsRes.data || []) as ClientOption[]);
    setCases((casesRes.data || []) as CaseOption[]);
  }, [tenantId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const openModal = () => {
    fetchClientsAndCases();
    setSelectedClient("");
    setSelectedCase("");
    setTitle("");
    setMessage("");
    setEmailOverride("");
    setDayOfMonth(10);
    setRepeatCount(3);
    setChannel("all");
    setStartDate(new Date().toISOString().split("T")[0]);
    setShowModal(true);
  };

  const calcNextSendDate = (start: string, day: number): string => {
    const d = new Date(start + "T12:00:00");
    d.setDate(day);
    if (d < new Date()) {
      d.setMonth(d.getMonth() + 1);
    }
    return d.toISOString().split("T")[0];
  };

  const handleSave = async () => {
    if (!tenantId || !userId || !selectedClient || !title || !message) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setSaving(true);
    try {
      const nextSend = calcNextSendDate(startDate, dayOfMonth);
      const { error } = await supabase.from("scheduled_notifications").insert({
        tenant_id: tenantId,
        created_by: userId,
        client_user_id: selectedClient,
        case_id: selectedCase || null,
        title,
        message,
        email_override: emailOverride || null,
        start_date: startDate,
        day_of_month: dayOfMonth,
        repeat_count: repeatCount,
        next_send_date: nextSend,
        channel,
      });
      if (error) throw error;
      toast.success("Notificação programada com sucesso!");
      setShowModal(false);
      fetchNotifications();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("scheduled_notifications").update({ is_active: false }).eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    toast.success("Notificação cancelada");
  };

  const clientName = (uid: string) => {
    const c = clients.find((cl) => cl.user_id === uid);
    return c?.full_name || uid.slice(0, 8);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
      <div className="bg-card rounded-xl border shadow-card p-5 h-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-accent" />
            <h2 className="font-semibold text-foreground">Notificador</h2>
            {notifications.length > 0 && (
              <Badge variant="secondary" className="text-xs">{notifications.length}</Badge>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={openModal} className="gap-1 text-xs h-7">
            <Plus className="w-3.5 h-3.5" /> Nova
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
        ) : notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma notificação programada</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {notifications.map((n) => (
              <div key={n.id} className="rounded-md border p-3 hover:border-accent/30 transition-all">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-medium text-foreground line-clamp-1">{n.title}</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(n.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">{n.message}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">Dia {n.day_of_month}</Badge>
                  <Badge variant="outline" className="text-[10px]">{n.sent_count}/{n.repeat_count} enviados</Badge>
                  <span className="text-[10px] text-muted-foreground">Próximo: {n.next_send_date.split("-").reverse().join("/")}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {n.channel === "all" ? "Push+Email" : n.channel === "push" ? "Push" : "Email"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Programar Notificação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Cliente *</Label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.user_id} value={c.user_id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Processo (opcional)</Label>
              <Select value={selectedCase} onValueChange={setSelectedCase}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {cases.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.process_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Título da notificação *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Lembrete de pagamento do acordo" />
            </div>

            <div>
              <Label className="text-xs">Mensagem *</Label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Texto que o cliente receberá..." rows={3} />
            </div>

            <div>
              <Label className="text-xs">E-mail do destinatário (deixe vazio para usar o cadastrado)</Label>
              <Input type="email" value={emailOverride} onChange={(e) => setEmailOverride(e.target.value)} placeholder="email@exemplo.com" />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Dia do mês</Label>
                <Input type="number" min={1} max={28} value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Repetir (meses)</Label>
                <Input type="number" min={1} max={60} value={repeatCount} onChange={(e) => setRepeatCount(Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Canal</Label>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Push + Email</SelectItem>
                    <SelectItem value="push">Só Push</SelectItem>
                    <SelectItem value="email">Só Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Data de início</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>

            <Button className="w-full gap-2" onClick={handleSave} disabled={saving}>
              <Send className="w-4 h-4" />
              {saving ? "Salvando..." : "Programar Notificação"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default DashboardNotificador;
