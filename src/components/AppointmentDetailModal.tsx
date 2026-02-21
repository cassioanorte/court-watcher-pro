import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  CalendarClock, Clock, Video, Users, Phone, FileText, Pencil, Trash2, Save, X, ExternalLink, LinkIcon,
} from "lucide-react";

const typeIcons: Record<string, typeof Video> = {
  "Videochamada": Video,
  "Reunião presencial": Users,
  "Ligação": Phone,
  "Atendimento interno": FileText,
  "Audiência": CalendarClock,
  "Consulta": FileText,
};

export interface AppointmentDetail {
  id: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  caseId: string | null;
  clientUserId: string | null;
  clientName: string | null;
  processNumber: string | null;
}

interface Props {
  appointment: AppointmentDetail | null;
  onClose: () => void;
  onUpdated: () => void;
}

const AppointmentDetailModal = ({ appointment, onClose, onUpdated }: Props) => {
  const { tenantId } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<AppointmentDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", description: "", date: "", startTime: "", endTime: "" });
  const [saving, setSaving] = useState(false);
  const [linkingCase, setLinkingCase] = useState(false);
  const [linkingClient, setLinkingClient] = useState(false);
  const [cases, setCases] = useState<{ id: string; process_number: string; client_user_id: string | null }[]>([]);
  const [contacts, setContacts] = useState<{ user_id: string; full_name: string }[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");

  useEffect(() => {
    if (appointment) {
      setData(appointment);
      setEditing(false);
      setLinkingCase(false);
      setLinkingClient(false);
      const startDate = new Date(appointment.startAt);
      const endDate = new Date(appointment.endAt);
      setEditForm({
        title: appointment.title,
        description: appointment.description || "",
        date: startDate.toISOString().slice(0, 10),
        startTime: startDate.toTimeString().slice(0, 5),
        endTime: endDate.toTimeString().slice(0, 5),
      });
    } else {
      setData(null);
    }
  }, [appointment]);

  const loadCasesAndContacts = async () => {
    if (!tenantId) return;
    const [casesRes, contactsRes] = await Promise.all([
      supabase.from("cases").select("id, process_number, client_user_id").eq("tenant_id", tenantId).eq("archived", false).order("process_number").limit(100),
      supabase.from("profiles").select("user_id, full_name").eq("tenant_id", tenantId).order("full_name").limit(200),
    ]);
    setCases(casesRes.data || []);
    setContacts(contactsRes.data || []);
  };

  const refreshData = async (id: string) => {
    const { data: apt } = await supabase
      .from("appointments")
      .select("id, title, description, start_at, end_at, case_id")
      .eq("id", id)
      .single();
    if (!apt) return;
    let caseInfo: { client_user_id: string | null; process_number: string } | null = null;
    let clientName: string | null = null;
    if (apt.case_id) {
      const { data: c } = await supabase.from("cases").select("id, client_user_id, process_number").eq("id", apt.case_id).single();
      if (c) {
        caseInfo = { client_user_id: c.client_user_id, process_number: c.process_number };
        if (c.client_user_id) {
          const { data: p } = await supabase.from("profiles").select("full_name").eq("user_id", c.client_user_id).single();
          clientName = p?.full_name || null;
        }
      }
    }
    setData({
      id: apt.id,
      title: apt.title,
      description: apt.description,
      startAt: apt.start_at,
      endAt: apt.end_at,
      caseId: apt.case_id,
      clientUserId: caseInfo?.client_user_id || null,
      clientName,
      processNumber: caseInfo?.process_number || null,
    });
    onUpdated();
  };

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    const start_at = `${editForm.date}T${editForm.startTime}:00`;
    const end_at = `${editForm.date}T${editForm.endTime}:00`;
    const { error } = await supabase
      .from("appointments")
      .update({ title: editForm.title, description: editForm.description || null, start_at, end_at })
      .eq("id", data.id);
    if (error) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } else {
      toast({ title: "Compromisso atualizado!" });
      setEditing(false);
      await refreshData(data.id);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!data) return;
    if (!confirm("Tem certeza que deseja excluir este compromisso?")) return;
    const { error } = await supabase.from("appointments").delete().eq("id", data.id);
    if (error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    } else {
      toast({ title: "Compromisso excluído" });
      onClose();
      onUpdated();
    }
  };

  const handleLinkCase = async () => {
    if (!data || !selectedCaseId) return;
    setSaving(true);
    const { error } = await supabase.from("appointments").update({ case_id: selectedCaseId }).eq("id", data.id);
    if (error) {
      toast({ title: "Erro ao vincular processo", variant: "destructive" });
    } else {
      toast({ title: "Processo vinculado!" });
      setLinkingCase(false);
      await refreshData(data.id);
    }
    setSaving(false);
  };

  const handleLinkClient = async () => {
    if (!data || !selectedClientId) return;
    setSaving(true);
    if (data.caseId) {
      // If there's already a linked case, update the case's client
      const { error } = await supabase.from("cases").update({ client_user_id: selectedClientId }).eq("id", data.caseId);
      if (error) {
        toast({ title: "Erro ao vincular cliente", variant: "destructive" });
      } else {
        toast({ title: "Cliente vinculado!" });
        setLinkingClient(false);
        await refreshData(data.id);
      }
    } else {
      // No case linked — just store the client name locally for display
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", selectedClientId).single();
      setData(prev => prev ? { ...prev, clientUserId: selectedClientId, clientName: profile?.full_name || "Cliente" } : prev);
      toast({ title: "Cliente vinculado!" });
      setLinkingClient(false);
    }
    setSaving(false);
  };

  const handleUnlinkCase = async () => {
    if (!data) return;
    if (!confirm("Desvincular o processo deste compromisso?")) return;
    setSaving(true);
    const { error } = await supabase.from("appointments").update({ case_id: null }).eq("id", data.id);
    if (error) {
      toast({ title: "Erro ao desvincular", variant: "destructive" });
    } else {
      toast({ title: "Processo desvinculado!" });
      await refreshData(data.id);
    }
    setSaving(false);
  };

  const handleUnlinkClient = async () => {
    if (!data || !data.caseId) return;
    if (!confirm("Desvincular o cliente deste processo?")) return;
    setSaving(true);
    const { error } = await supabase.from("cases").update({ client_user_id: null }).eq("id", data.caseId);
    if (error) {
      toast({ title: "Erro ao desvincular", variant: "destructive" });
    } else {
      toast({ title: "Cliente desvinculado!" });
      await refreshData(data.id);
    }
    setSaving(false);
  };

  const startLinkCase = () => {
    loadCasesAndContacts();
    setSelectedCaseId("");
    setLinkingCase(true);
  };

  const startLinkClient = () => {
    loadCasesAndContacts();
    setSelectedClientId("");
    setLinkingClient(true);
  };

  const Icon = data ? (typeIcons[data.title] || CalendarClock) : CalendarClock;

  return (
    <Dialog open={!!data} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-accent" />
            {editing ? "Editar Compromisso" : linkingCase ? "Vincular Processo" : linkingClient ? "Vincular Cliente" : "Detalhes do Compromisso"}
          </DialogTitle>
          <DialogDescription>
            {editing ? "Edite as informações abaixo" : linkingCase ? "Selecione um processo" : linkingClient ? "Selecione um cliente" : "Visualize ou edite este compromisso"}
          </DialogDescription>
        </DialogHeader>

        {/* Link case form */}
        {data && linkingCase && (
          <div className="space-y-3">
            <Select value={selectedCaseId} onValueChange={setSelectedCaseId}>
              <SelectTrigger><SelectValue placeholder="Selecione um processo..." /></SelectTrigger>
              <SelectContent>
                {cases.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.process_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setLinkingCase(false)}>
                <X className="w-3.5 h-3.5 mr-1" /> Cancelar
              </Button>
              <Button size="sm" className="flex-1" onClick={handleLinkCase} disabled={!selectedCaseId || saving}>
                <LinkIcon className="w-3.5 h-3.5 mr-1" /> {saving ? "Vinculando..." : "Vincular"}
              </Button>
            </div>
          </div>
        )}

        {/* Link client form */}
        {data && linkingClient && (
          <div className="space-y-3">
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger><SelectValue placeholder="Selecione um cliente..." /></SelectTrigger>
              <SelectContent>
                {contacts.map((c) => (
                  <SelectItem key={c.user_id} value={c.user_id}>{c.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setLinkingClient(false)}>
                <X className="w-3.5 h-3.5 mr-1" /> Cancelar
              </Button>
              <Button size="sm" className="flex-1" onClick={handleLinkClient} disabled={!selectedClientId || saving}>
                <LinkIcon className="w-3.5 h-3.5 mr-1" /> {saving ? "Vinculando..." : "Vincular"}
              </Button>
            </div>
          </div>
        )}

        {/* View mode */}
        {data && !editing && !linkingCase && !linkingClient && (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Tipo</p>
              <p className="text-sm text-foreground font-medium mt-0.5">{data.title}</p>
            </div>
            {data.description && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Descrição</p>
                <p className="text-sm text-foreground mt-0.5 whitespace-pre-wrap break-all">
                  {data.description.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
                    /^https?:\/\//.test(part) ? (
                      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline inline-flex items-center gap-0.5">
                        <Video className="w-3.5 h-3.5 shrink-0" />{part.length > 50 ? part.slice(0, 50) + "…" : part}
                      </a>
                    ) : (
                      <span key={i}>{part}</span>
                    )
                  )}
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Data</p>
                <p className="text-sm text-foreground mt-0.5">
                  {new Date(data.startAt).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Horário</p>
                <p className="text-sm text-foreground mt-0.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-accent" />
                  {new Date(data.startAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  {" — "}
                  {new Date(data.endAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>

            {/* Process */}
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Processo</p>
              {data.caseId ? (
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <Link to={`/processos/${data.caseId}`} className="text-sm text-accent hover:underline inline-flex items-center gap-1">
                    <ExternalLink className="w-3.5 h-3.5" />
                    {data.processNumber || "Ver processo"} →
                  </Link>
                  <Button size="sm" variant="ghost" className="text-xs h-6 px-2 text-muted-foreground" onClick={startLinkCase}>
                    <Pencil className="w-3 h-3 mr-1" /> Alterar
                  </Button>
                  <Button size="sm" variant="ghost" className="text-xs h-6 px-2 text-destructive hover:text-destructive" onClick={handleUnlinkCase}>
                    <X className="w-3 h-3 mr-1" /> Desvincular
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="mt-1 gap-1.5 text-xs h-7" onClick={startLinkCase}>
                  <LinkIcon className="w-3 h-3" /> Vincular processo
                </Button>
              )}
            </div>

            {/* Client */}
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Cliente</p>
              {data.clientUserId ? (
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <Link to={`/contatos/${data.clientUserId}`} className="text-sm text-accent hover:underline inline-flex items-center gap-1">
                    <ExternalLink className="w-3.5 h-3.5" />
                    {data.clientName || "Ver cliente"} →
                  </Link>
                  <Button size="sm" variant="ghost" className="text-xs h-6 px-2 text-muted-foreground" onClick={startLinkClient}>
                    <Pencil className="w-3 h-3 mr-1" /> Alterar
                  </Button>
                  <Button size="sm" variant="ghost" className="text-xs h-6 px-2 text-destructive hover:text-destructive" onClick={handleUnlinkClient}>
                    <X className="w-3 h-3 mr-1" /> Desvincular
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="mt-1 gap-1.5 text-xs h-7" onClick={startLinkClient}>
                  <LinkIcon className="w-3 h-3" /> Vincular cliente
                </Button>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => setEditing(true)}>
                <Pencil className="w-3.5 h-3.5" /> Editar
              </Button>
              <Button size="sm" variant="destructive" className="gap-1.5" onClick={handleDelete}>
                <Trash2 className="w-3.5 h-3.5" /> Excluir
              </Button>
            </div>
          </div>
        )}

        {/* Edit mode */}
        {data && editing && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Tipo</label>
              <input
                value={editForm.title}
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full mt-1 h-9 rounded-md border bg-background px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Descrição</label>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full mt-1 rounded-md border bg-background px-3 py-2 text-sm resize-none"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Data</label>
                <input
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full mt-1 h-9 rounded-md border bg-background px-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Início</label>
                <input
                  type="time"
                  value={editForm.startTime}
                  onChange={(e) => setEditForm((f) => ({ ...f, startTime: e.target.value }))}
                  className="w-full mt-1 h-9 rounded-md border bg-background px-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Fim</label>
                <input
                  type="time"
                  value={editForm.endTime}
                  onChange={(e) => setEditForm((f) => ({ ...f, endTime: e.target.value }))}
                  className="w-full mt-1 h-9 rounded-md border bg-background px-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => setEditing(false)}>
                <X className="w-3.5 h-3.5" /> Cancelar
              </Button>
              <Button size="sm" className="flex-1 gap-1.5" onClick={handleSave} disabled={saving}>
                <Save className="w-3.5 h-3.5" /> {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AppointmentDetailModal;
