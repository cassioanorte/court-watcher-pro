import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { toast } from "sonner";
import { format, isSameDay, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Trash2, CalendarIcon, Clock, Video, Copy, LinkIcon, Phone, Users, FileText, Link2, Pencil, X, Save } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Appointment {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  case_id: string | null;
  color: string | null;
}

interface CaseOption {
  id: string;
  process_number: string;
  subject: string | null;
}

const typeOptions = [
  { value: "Reunião presencial", icon: Users },
  { value: "Videochamada", icon: Video },
  { value: "Ligação", icon: Phone },
  { value: "Audiência", icon: CalendarIcon },
  { value: "Consulta", icon: FileText },
];

const DashboardCalendar = () => {
  const { tenantId, user } = useAuth();
  const { isConnected: googleConnected, connect: connectGoogle, createMeetEvent, loading: googleLoading } = useGoogleCalendar();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [showNewModal, setShowNewModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [videoPlatform, setVideoPlatform] = useState<"jitsi" | "google_meet">(googleConnected ? "google_meet" : "jitsi");
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", description: "", date: "", startTime: "", endTime: "" });
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "Reunião presencial",
    description: "",
    start_time: "09:00",
    end_time: "10:00",
    case_id: "",
  });

  const openDetail = (appt: Appointment) => {
    setSelectedAppt(appt);
    setEditing(false);
    setEditForm({
      title: appt.title,
      description: appt.description || "",
      date: format(new Date(appt.start_at), "yyyy-MM-dd"),
      startTime: format(new Date(appt.start_at), "HH:mm"),
      endTime: format(new Date(appt.end_at), "HH:mm"),
    });
  };

  const handleSaveEdit = async () => {
    if (!selectedAppt) return;
    setSaving(true);
    const start_at = `${editForm.date}T${editForm.startTime}:00`;
    const end_at = `${editForm.date}T${editForm.endTime}:00`;
    const { error } = await supabase.from("appointments").update({
      title: editForm.title,
      description: editForm.description || null,
      start_at,
      end_at,
    }).eq("id", selectedAppt.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar");
      return;
    }
    setAppointments((prev) => prev.map((a) => a.id === selectedAppt.id ? { ...a, title: editForm.title, description: editForm.description || null, start_at, end_at } : a));
    setSelectedAppt({ ...selectedAppt, title: editForm.title, description: editForm.description || null, start_at, end_at });
    setEditing(false);
    toast.success("Compromisso atualizado!");
  };

  const handleDeleteFromModal = async () => {
    if (!selectedAppt) return;
    const { error } = await supabase.from("appointments").delete().eq("id", selectedAppt.id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    setAppointments((prev) => prev.filter((a) => a.id !== selectedAppt.id));
    setSelectedAppt(null);
    toast.success("Compromisso removido");
  };

  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      const [apptRes, casesRes] = await Promise.all([
        supabase.from("appointments").select("id, title, description, start_at, end_at, case_id, color").eq("tenant_id", tenantId),
        supabase.from("cases").select("id, process_number, subject").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
      ]);
      setAppointments(apptRes.data || []);
      setCases(casesRes.data || []);
      setLoading(false);
    };
    load();
  }, [tenantId]);

  const dayAppointments = appointments
    .filter((a) => isSameDay(new Date(a.start_at), selectedDate))
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  const daysWithAppointments = appointments.map((a) => startOfDay(new Date(a.start_at)));

  const generateJitsiLink = (appointmentId: string): string => {
    const roomName = `atendimento-${appointmentId.slice(0, 8)}`;
    return `https://meet.jit.si/${roomName}`;
  };

  const handleCreate = async () => {
    if (!form.title || !tenantId || !user?.id) return;

    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const start_at = `${dateStr}T${form.start_time}:00`;
    const end_at = `${dateStr}T${form.end_time}:00`;

    const { data, error } = await supabase.from("appointments").insert({
      tenant_id: tenantId,
      user_id: user.id,
      title: form.title,
      description: form.description || null,
      start_at,
      end_at,
      case_id: form.case_id || null,
    }).select().single();

    if (error) {
      toast.error("Erro ao criar compromisso");
      return;
    }

    // Generate video link if Videochamada
    let videoLink: string | null = null;
    if (form.title === "Videochamada" && data?.id) {
      if (videoPlatform === "google_meet" && googleConnected) {
        try {
          const result = await createMeetEvent({
            title: form.title,
            description: form.description,
            start_at,
            end_at,
          });
          videoLink = result?.meet_link || null;
        } catch {
          videoLink = generateJitsiLink(data.id);
          toast.error("Falha no Google Meet, usando Jitsi");
        }
      } else {
        videoLink = generateJitsiLink(data.id);
      }

      // Update description with video link
      if (videoLink) {
        const updatedDesc = `${form.description || ""}\n\n🔗 Link da videochamada: ${videoLink}`.trim();
        await supabase.from("appointments").update({ description: updatedDesc }).eq("id", data.id);
        data.description = updatedDesc;
      }
    }

    setAppointments((prev) => [...prev, data]);
    setForm({ title: "Reunião presencial", description: "", start_time: "09:00", end_time: "10:00", case_id: "" });
    setShowNewModal(false);
    toast.success("Compromisso adicionado!");
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    setAppointments((prev) => prev.filter((a) => a.id !== id));
    toast.success("Compromisso removido");
  };

  const getTypeIcon = (title: string) => {
    const found = typeOptions.find((t) => t.value === title);
    return found ? found.icon : CalendarIcon;
  };

  return (
    <div className="bg-card rounded-lg shadow-card border">
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-accent" /> Agenda
        </h2>
        <Button size="sm" onClick={() => setShowNewModal(true)} className="gap-1">
          <Plus className="w-3.5 h-3.5" /> Novo
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-0 md:gap-4">
        {/* Calendar */}
        <div className="p-3 flex justify-center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(d) => d && setSelectedDate(d)}
            locale={ptBR}
            className="pointer-events-auto"
            modifiers={{ hasAppointment: daysWithAppointments }}
            modifiersClassNames={{ hasAppointment: "bg-accent/20 font-bold text-accent" }}
          />
        </div>

        {/* Day appointments */}
        <div className="border-t md:border-t-0 md:border-l px-5 py-4 min-h-[200px]">
          <p className="text-sm font-medium text-muted-foreground mb-3">
            {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : dayAppointments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum compromisso neste dia.</p>
          ) : (
            <div className="space-y-2">
              {dayAppointments.map((appt, i) => {
                const videoLinkMatch = appt.description?.match(/(https:\/\/meet\.jit\.si\/[^\s]+)/);
                const videoLink = videoLinkMatch ? videoLinkMatch[1] : null;
                const descWithoutLink = appt.description?.replace(/\n\n🔗 Link da videochamada: https:\/\/meet\.jit\.si\/[^\s]+/, "").trim();
                return (
                  <motion.div
                    key={appt.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-md bg-muted/50 group"
                  >
                    <div className="flex items-start gap-3 p-3">
                      <div className="w-1 h-full min-h-[32px] rounded-full bg-accent shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{appt.title}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {format(new Date(appt.start_at), "HH:mm")} – {format(new Date(appt.end_at), "HH:mm")}
                        </p>
                        {descWithoutLink && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">{descWithoutLink}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(appt.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {videoLink && (
                      <div className="border-t border-border/50 px-3 py-2.5 space-y-2">
                        <div className="flex items-center gap-2 bg-background/50 rounded-md px-2.5 py-1.5">
                          <LinkIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs text-foreground font-mono truncate flex-1">{videoLink}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <a
                            href={videoLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                          >
                            <Video className="w-3.5 h-3.5" /> Entrar
                          </a>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(videoLink);
                              toast.success("Link copiado!");
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium text-foreground hover:bg-muted transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" /> Copiar
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* New Appointment Modal */}
      <Dialog open={showNewModal} onOpenChange={setShowNewModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Compromisso</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Type selection */}
            <div>
              <label className="text-sm font-medium text-foreground">Tipo *</label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {typeOptions.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm({ ...form, title: opt.value })}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                        form.title === opt.value
                          ? "bg-accent text-accent-foreground border-accent"
                          : "bg-background text-foreground border-border hover:bg-muted"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" /> {opt.value}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Video platform picker */}
            {form.title === "Videochamada" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Plataforma de vídeo</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setVideoPlatform("jitsi")}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                      videoPlatform === "jitsi"
                        ? "bg-accent text-accent-foreground border-accent"
                        : "bg-background text-foreground border-border hover:bg-muted"
                    )}
                  >
                    <Video className="w-3.5 h-3.5" /> Jitsi Meet
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (googleConnected) {
                        setVideoPlatform("google_meet");
                      } else {
                        connectGoogle();
                      }
                    }}
                    disabled={googleLoading}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                      videoPlatform === "google_meet" && googleConnected
                        ? "bg-accent text-accent-foreground border-accent"
                        : "bg-background text-foreground border-border hover:bg-muted"
                    )}
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    {googleConnected ? "Google Meet" : googleLoading ? "Conectando..." : "Conectar Google Meet"}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {videoPlatform === "jitsi"
                    ? "Link do Jitsi será gerado automaticamente"
                    : "Evento criado no Google Calendar com link do Meet"}
                </p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-foreground">Descrição</label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detalhes do compromisso" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground">Início</label>
                <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Fim</label>
                <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Data</label>
              <p className="text-sm text-muted-foreground">{format(selectedDate, "dd/MM/yyyy")}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Processo vinculado</label>
              <Select value={form.case_id} onValueChange={(v) => setForm({ ...form, case_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {cases.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.process_number} {c.subject ? `- ${c.subject}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewModal(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!form.title}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DashboardCalendar;
