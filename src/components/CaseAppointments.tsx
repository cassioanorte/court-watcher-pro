import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, Plus, X, Save, Phone, Video, Users, FileText, Send, Mail, MessageCircle, ExternalLink, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Appointment = {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  color: string | null;
};

type ClientInfo = {
  full_name: string;
  phone: string | null;
  email: string | null;
};

const typeOptions = [
  { value: "Reunião presencial", icon: Users },
  { value: "Videochamada", icon: Video },
  { value: "Ligação", icon: Phone },
  { value: "Atendimento interno", icon: FileText },
];

const CaseAppointments = ({ caseId, tenantId }: { caseId: string; tenantId: string }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "Reunião presencial",
    description: "",
    date: "",
    startTime: "09:00",
    endTime: "10:00",
  });

  // Notification dialog state
  const [showNotifyDialog, setShowNotifyDialog] = useState(false);
  const [savedAppointment, setSavedAppointment] = useState<{
    title: string;
    description: string;
    date: string;
    startTime: string;
    endTime: string;
    videoLink: string | null;
  } | null>(null);
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  const fetchAppointments = async () => {
    const { data } = await supabase
      .from("appointments")
      .select("id, title, description, start_at, end_at, color")
      .eq("case_id", caseId)
      .eq("tenant_id", tenantId)
      .order("start_at", { ascending: false });
    setAppointments(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAppointments();
  }, [caseId]);

  // Fetch client info from case
  const fetchClientInfo = async (): Promise<ClientInfo | null> => {
    const { data: caseData } = await supabase
      .from("cases")
      .select("client_user_id")
      .eq("id", caseId)
      .single();

    if (!caseData?.client_user_id) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone, email")
      .eq("user_id", caseData.client_user_id)
      .single();

    return profile || null;
  };

  const generateJitsiLink = (appointmentId: string): string => {
    const roomName = `atendimento-${appointmentId.slice(0, 8)}`;
    return `https://meet.jit.si/${roomName}`;
  };

  const normalizePhone = (phone: string): string | null => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 11 && digits[2] === "9") {
      return digits.startsWith("55") ? digits : `55${digits}`;
    }
    if (digits.length === 13 && digits.startsWith("55") && digits[4] === "9") {
      return digits;
    }
    return null;
  };

  const buildNotificationMessage = (data: NonNullable<typeof savedAppointment>, clientName?: string): string => {
    const dateFormatted = new Date(`${data.date}T00:00:00`).toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    let msg = `Olá${clientName ? `, ${clientName}` : ""}! 👋\n\n`;
    msg += `Seu atendimento foi agendado:\n\n`;
    msg += `📋 *Tipo:* ${data.title}\n`;
    msg += `📅 *Data:* ${dateFormatted}\n`;
    msg += `🕐 *Horário:* ${data.startTime} às ${data.endTime}\n`;
    if (data.description) {
      msg += `📝 *Obs:* ${data.description}\n`;
    }
    if (data.videoLink) {
      msg += `\n🔗 *Link da videochamada:*\n${data.videoLink}\n`;
    }
    msg += `\nQualquer dúvida, entre em contato.`;
    return msg;
  };

  const handleWhatsApp = () => {
    if (!clientInfo?.phone || !savedAppointment) return;
    const normalized = normalizePhone(clientInfo.phone);
    if (!normalized) {
      toast({ title: "Número inválido", description: "O telefone do cliente não é um celular válido.", variant: "destructive" });
      return;
    }
    const msg = buildNotificationMessage(savedAppointment, clientInfo.full_name);
    const url = `https://wa.me/${normalized}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
    setShowNotifyDialog(false);
  };

  const handleSendEmail = async () => {
    if (!clientInfo?.email || !savedAppointment) return;
    setSendingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-appointment-email", {
        body: {
          clientEmail: clientInfo.email,
          clientName: clientInfo.full_name,
          appointmentTitle: savedAppointment.title,
          appointmentDate: savedAppointment.date,
          startTime: savedAppointment.startTime,
          endTime: savedAppointment.endTime,
          description: savedAppointment.description || null,
          videoLink: savedAppointment.videoLink,
          tenantId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "E-mail enviado com sucesso!" });
      setShowNotifyDialog(false);
    } catch (err: any) {
      toast({ title: "Erro ao enviar e-mail", description: err.message, variant: "destructive" });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.date || !form.title) return;
    setSaving(true);

    const start_at = `${form.date}T${form.startTime}:00`;
    const end_at = `${form.date}T${form.endTime}:00`;

    const { data: inserted, error } = await supabase.from("appointments").insert({
      title: form.title,
      description: form.description || null,
      start_at,
      end_at,
      case_id: caseId,
      tenant_id: tenantId,
      user_id: user.id,
    }).select("id").single();

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Atendimento registrado!" });

      const videoLink = form.title === "Videochamada" && inserted?.id
        ? generateJitsiLink(inserted.id)
        : null;

      // Log activity
      await supabase.from("case_activities").insert({
        case_id: caseId,
        tenant_id: tenantId,
        user_id: user.id,
        action_type: "appointment_created",
        description: `Atendimento registrado: ${form.title}`,
        metadata: { start_at, end_at, type: form.title, video_link: videoLink },
      });

      // Prepare notification dialog
      const client = await fetchClientInfo();
      if (client && (client.phone || client.email)) {
        setClientInfo(client);
        setSavedAppointment({
          title: form.title,
          description: form.description,
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime,
          videoLink,
        });
        setShowNotifyDialog(true);
      }

      setShowForm(false);
      setForm({ title: "Reunião presencial", description: "", date: "", startTime: "09:00", endTime: "10:00" });
      fetchAppointments();
    }
    setSaving(false);
  };

  const now = new Date();
  const upcoming = appointments.filter((a) => new Date(a.start_at) >= now);
  const past = appointments.filter((a) => new Date(a.start_at) < now);

  const formatDateTime = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) +
      " às " +
      date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const getTypeIcon = (title: string) => {
    const found = typeOptions.find((t) => t.value === title);
    return found ? found.icon : Calendar;
  };

  if (loading) return <p className="text-xs text-muted-foreground py-2">Carregando atendimentos...</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-accent" /> Atendimentos ({appointments.length})
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1 text-[10px] text-accent hover:underline font-medium"
        >
          {showForm ? <><X className="w-3 h-3" /> Cancelar</> : <><Plus className="w-3 h-3" /> Novo</>}
        </button>
      </div>

      {/* New appointment form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-muted/50 rounded-lg p-3 space-y-3 border">
          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Tipo</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {typeOptions.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, title: opt.value }))}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      form.title === opt.value
                        ? "bg-accent text-accent-foreground border-accent"
                        : "bg-background text-foreground border-border hover:bg-muted"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" /> {opt.value}
                  </button>
                );
              })}
            </div>
          </div>

          {form.title === "Videochamada" && (
            <p className="text-[10px] text-accent flex items-center gap-1">
              <Video className="w-3 h-3" /> Link do Jitsi Meet será gerado automaticamente
            </p>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Data *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                required
                className="w-full mt-1 h-8 px-2 rounded-lg bg-background border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Início</label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                className="w-full mt-1 h-8 px-2 rounded-lg bg-background border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Fim</label>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                className="w-full mt-1 h-8 px-2 rounded-lg bg-background border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Anotações</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Detalhes do atendimento..."
              rows={2}
              className="w-full mt-1 px-2 py-1.5 rounded-lg bg-background border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full h-8 rounded-lg gradient-accent text-accent-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" /> {saving ? "Salvando..." : "Registrar Atendimento"}
          </button>
        </form>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div>
          <p className="text-[10px] text-accent font-semibold uppercase tracking-wide mb-1.5">Agendados</p>
          <div className="space-y-1.5">
            {upcoming.map((a) => {
              const Icon = getTypeIcon(a.title);
              return (
                <div key={a.id} className="flex items-start gap-2.5 bg-accent/5 border border-accent/20 rounded-lg px-3 py-2">
                  <Icon className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{a.title}</p>
                    {a.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.description}</p>}
                    <p className="text-[10px] text-accent mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatDateTime(a.start_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1.5">Histórico</p>
          <div className="space-y-1 divide-y rounded-lg border overflow-hidden">
            {past.map((a) => {
              const Icon = getTypeIcon(a.title);
              return (
                <div key={a.id} className="flex items-start gap-2.5 px-3 py-2 hover:bg-muted/30 transition-colors">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">{a.title}</p>
                    {a.description && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{a.description}</p>}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{formatDateTime(a.start_at)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {appointments.length === 0 && !showForm && (
        <p className="text-xs text-muted-foreground py-2">Nenhum atendimento registrado.</p>
      )}

      {/* Notification dialog */}
      <Dialog open={showNotifyDialog} onOpenChange={setShowNotifyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-4 h-4 text-accent" /> Notificar Cliente
            </DialogTitle>
            <DialogDescription>
              Deseja enviar uma mensagem avisando o cliente sobre este atendimento?
            </DialogDescription>
          </DialogHeader>

          {clientInfo && savedAppointment && (
            <div className="space-y-4">
              {/* Appointment summary */}
              <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-xs">
                <p><span className="font-medium text-muted-foreground">Tipo:</span> {savedAppointment.title}</p>
                <p><span className="font-medium text-muted-foreground">Data:</span> {new Date(`${savedAppointment.date}T00:00:00`).toLocaleDateString("pt-BR")} — {savedAppointment.startTime} às {savedAppointment.endTime}</p>
                {savedAppointment.description && (
                  <p><span className="font-medium text-muted-foreground">Obs:</span> {savedAppointment.description}</p>
                )}
                {savedAppointment.videoLink && (
                  <p className="flex items-center gap-1">
                    <Video className="w-3 h-3 text-accent" />
                    <a href={savedAppointment.videoLink} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                      {savedAppointment.videoLink}
                    </a>
                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                  </p>
                )}
              </div>

              {/* Client info */}
              <div className="text-xs space-y-1">
                <p className="font-medium text-foreground">Cliente: {clientInfo.full_name}</p>
                {clientInfo.phone && <p className="text-muted-foreground">📱 {clientInfo.phone}</p>}
                {clientInfo.email && <p className="text-muted-foreground">✉️ {clientInfo.email}</p>}
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-2">
                {clientInfo.phone && normalizePhone(clientInfo.phone) && (
                  <button
                    onClick={handleWhatsApp}
                    className="w-full h-10 rounded-lg bg-[#25D366] text-white text-sm font-semibold hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-2"
                  >
                    <MessageCircle className="w-4 h-4" /> Enviar via WhatsApp
                  </button>
                )}
                {clientInfo.email && (
                  <button
                    onClick={handleSendEmail}
                    disabled={sendingEmail}
                    className="w-full h-10 rounded-lg gradient-accent text-accent-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  >
                    {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                    {sendingEmail ? "Enviando..." : "Enviar por E-mail"}
                  </button>
                )}
                <button
                  onClick={() => setShowNotifyDialog(false)}
                  className="w-full h-9 rounded-lg border text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Não notificar
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CaseAppointments;
