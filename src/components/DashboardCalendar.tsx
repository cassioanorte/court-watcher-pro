import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format, isSameDay, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Trash2, CalendarIcon, Clock } from "lucide-react";
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

const DashboardCalendar = () => {
  const { tenantId, user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [showNewModal, setShowNewModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    title: "",
    description: "",
    start_time: "09:00",
    end_time: "10:00",
    case_id: "",
  });

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

    setAppointments((prev) => [...prev, data]);
    setForm({ title: "", description: "", start_time: "09:00", end_time: "10:00", case_id: "" });
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
              {dayAppointments.map((appt, i) => (
                <motion.div
                  key={appt.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-3 p-3 rounded-md bg-muted/50 group"
                >
                  <div className="w-1 h-full min-h-[32px] rounded-full bg-accent shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{appt.title}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {format(new Date(appt.start_at), "HH:mm")} – {format(new Date(appt.end_at), "HH:mm")}
                    </p>
                    {appt.description && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{appt.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(appt.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
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
            <div>
              <label className="text-sm font-medium text-foreground">Título *</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Audiência inicial" />
            </div>
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
