import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CalendarClock, Clock, Video, Users, Phone, FileText } from "lucide-react";
import AppointmentDetailModal, { type AppointmentDetail } from "@/components/AppointmentDetailModal";

const typeIcons: Record<string, typeof Video> = {
  "Videochamada": Video,
  "Reunião presencial": Users,
  "Ligação": Phone,
  "Atendimento interno": FileText,
  "Audiência": CalendarClock,
  "Consulta": FileText,
};

interface Appointment {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  case_id: string | null;
  client_user_id: string | null;
}

const ContactAppointments = ({ contactUserId, tenantId }: { contactUserId: string; tenantId: string }) => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppt, setSelectedAppt] = useState<AppointmentDetail | null>(null);

  const fetchAppointments = async () => {
    // Fetch appointments linked directly to this contact OR via cases owned by this contact
    const [directRes, casesRes] = await Promise.all([
      supabase
        .from("appointments")
        .select("id, title, description, start_at, end_at, case_id, client_user_id")
        .eq("tenant_id", tenantId)
        .eq("client_user_id", contactUserId)
        .order("start_at", { ascending: false }),
      supabase
        .from("cases")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("client_user_id", contactUserId),
    ]);

    const caseIds = (casesRes.data || []).map((c) => c.id);
    let caseAppointments: Appointment[] = [];
    if (caseIds.length > 0) {
      const { data } = await supabase
        .from("appointments")
        .select("id, title, description, start_at, end_at, case_id, client_user_id")
        .eq("tenant_id", tenantId)
        .in("case_id", caseIds)
        .order("start_at", { ascending: false });
      caseAppointments = data || [];
    }

    // Merge and deduplicate
    const allMap = new Map<string, Appointment>();
    [...(directRes.data || []), ...caseAppointments].forEach((a) => allMap.set(a.id, a));
    const merged = Array.from(allMap.values()).sort(
      (a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime()
    );
    setAppointments(merged);
    setLoading(false);
  };

  useEffect(() => {
    fetchAppointments();
  }, [contactUserId, tenantId]);

  const openDetail = async (a: Appointment) => {
    let processNumber: string | null = null;
    let clientName: string | null = null;

    if (a.case_id) {
      const { data: c } = await supabase.from("cases").select("process_number").eq("id", a.case_id).single();
      processNumber = c?.process_number || null;
    }

    const { data: p } = await supabase.from("profiles").select("full_name").eq("user_id", contactUserId).single();
    clientName = p?.full_name || null;

    setSelectedAppt({
      id: a.id,
      title: a.title,
      description: a.description,
      startAt: a.start_at,
      endAt: a.end_at,
      caseId: a.case_id,
      clientUserId: a.client_user_id || contactUserId,
      clientName,
      processNumber,
    });
  };

  if (loading) {
    return (
      <div className="bg-card border rounded-lg p-8 text-center">
        <p className="text-sm text-muted-foreground">Carregando compromissos...</p>
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="bg-card border rounded-lg p-8 text-center">
        <CalendarClock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Nenhum compromisso encontrado para este contato.</p>
        <p className="text-xs text-muted-foreground mt-1">Compromissos podem ser criados na página do processo ou na agenda.</p>
      </div>
    );
  }

  const now = new Date();
  const upcoming = appointments.filter((a) => new Date(a.start_at) >= now);
  const past = appointments.filter((a) => new Date(a.start_at) < now);

  return (
    <>
      <div className="space-y-4">
        {upcoming.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">Próximos</h3>
            <div className="space-y-2">
              {upcoming.map((a) => {
                const Icon = typeIcons[a.title] || CalendarClock;
                return (
                  <div
                    key={a.id}
                    className="flex items-start gap-2.5 bg-accent/5 border border-accent/20 rounded-lg px-3 py-2 cursor-pointer hover:bg-accent/10 transition-colors"
                    onClick={() => openDetail(a)}
                  >
                    <Icon className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{a.title}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(a.start_at).toLocaleDateString("pt-BR")} às{" "}
                        {new Date(a.start_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {past.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Anteriores</h3>
            <div className="space-y-1.5">
              {past.map((a) => {
                const Icon = typeIcons[a.title] || CalendarClock;
                return (
                  <div
                    key={a.id}
                    className="flex items-start gap-2.5 px-3 py-2 hover:bg-muted/30 rounded-lg transition-colors cursor-pointer"
                    onClick={() => openDetail(a)}
                  >
                    <Icon className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-muted-foreground">{a.title}</p>
                      <p className="text-xs text-muted-foreground/60 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(a.start_at).toLocaleDateString("pt-BR")} às{" "}
                        {new Date(a.start_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <AppointmentDetailModal
        appointment={selectedAppt}
        onClose={() => setSelectedAppt(null)}
        onUpdated={fetchAppointments}
      />
    </>
  );
};

export default ContactAppointments;
