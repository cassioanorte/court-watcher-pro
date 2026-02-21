import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { CalendarClock, AlertTriangle, ArrowRight, Clock, FileText, Video, Users, Phone, Pencil, Trash2, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Deadline {
  id: string;
  title: string;
  description: string | null;
  due: string;
  endAt: string | null;
  type: "appointment" | "crm_task";
  link: string;
  overdue: boolean;
  caseId: string | null;
}

const typeIcons: Record<string, typeof Video> = {
  "Videochamada": Video,
  "Reunião presencial": Users,
  "Ligação": Phone,
  "Atendimento interno": FileText,
};

const DashboardDeadlines = () => {
  const { tenantId } = useAuth();
  const { toast } = useToast();
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [selectedDeadline, setSelectedDeadline] = useState<Deadline | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", description: "", date: "", startTime: "", endTime: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!tenantId) return;
    const now = new Date();
    const in7days = new Date();
    in7days.setDate(in7days.getDate() + 7);

    const [aptsRes, tasksRes] = await Promise.all([
      supabase
        .from("appointments")
        .select("id, title, description, start_at, end_at, case_id")
        .eq("tenant_id", tenantId)
        .gte("start_at", now.toISOString())
        .lte("start_at", in7days.toISOString())
        .order("start_at")
        .limit(5),
      supabase
        .from("crm_tasks")
        .select("id, title, description, due_date, lead_id")
        .eq("tenant_id", tenantId)
        .eq("completed", false)
        .lte("due_date", in7days.toISOString().split("T")[0])
        .order("due_date")
        .limit(5),
    ]);

    const items: Deadline[] = [];
    (aptsRes.data || []).forEach((a) =>
      items.push({
        id: a.id,
        title: a.title,
        description: a.description,
        due: a.start_at,
        endAt: a.end_at,
        type: "appointment",
        link: a.case_id ? `/processos/${a.case_id}` : "/agenda",
        overdue: new Date(a.start_at) < now,
        caseId: a.case_id,
      })
    );
    (tasksRes.data || []).forEach((t) =>
      items.push({
        id: t.id,
        title: t.title,
        description: t.description,
        due: t.due_date,
        endAt: null,
        type: "crm_task",
        link: "/crm",
        overdue: new Date(t.due_date) < new Date(now.toISOString().split("T")[0]),
        caseId: null,
      })
    );

    items.sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());
    setDeadlines(items.slice(0, 8));
  };

  useEffect(() => {
    load();
  }, [tenantId]);

  const openDetail = (d: Deadline) => {
    setSelectedDeadline(d);
    setEditing(false);
    if (d.type === "appointment") {
      const startDate = new Date(d.due);
      const endDate = d.endAt ? new Date(d.endAt) : startDate;
      setEditForm({
        title: d.title,
        description: d.description || "",
        date: startDate.toISOString().slice(0, 10),
        startTime: startDate.toTimeString().slice(0, 5),
        endTime: endDate.toTimeString().slice(0, 5),
      });
    }
  };

  const handleSave = async () => {
    if (!selectedDeadline) return;
    setSaving(true);
    if (selectedDeadline.type === "appointment") {
      const start_at = `${editForm.date}T${editForm.startTime}:00`;
      const end_at = `${editForm.date}T${editForm.endTime}:00`;
      const { error } = await supabase
        .from("appointments")
        .update({ title: editForm.title, description: editForm.description || null, start_at, end_at })
        .eq("id", selectedDeadline.id);
      if (error) {
        toast({ title: "Erro ao salvar", variant: "destructive" });
      } else {
        toast({ title: "Compromisso atualizado!" });
        setSelectedDeadline(null);
        load();
      }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!selectedDeadline) return;
    if (!confirm("Tem certeza que deseja excluir este compromisso?")) return;
    if (selectedDeadline.type === "appointment") {
      const { error } = await supabase.from("appointments").delete().eq("id", selectedDeadline.id);
      if (error) {
        toast({ title: "Erro ao excluir", variant: "destructive" });
      } else {
        toast({ title: "Compromisso excluído" });
        setSelectedDeadline(null);
        load();
      }
    }
  };

  const overdueCount = deadlines.filter((d) => d.overdue).length;
  const Icon = selectedDeadline ? (typeIcons[selectedDeadline.title] || CalendarClock) : CalendarClock;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-card rounded-xl border shadow-card p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-accent" />
            <h2 className="font-semibold text-foreground">Próximos Compromissos</h2>
            {overdueCount > 0 && (
              <Badge variant="destructive" className="text-xs gap-1">
                <AlertTriangle className="w-3 h-3" /> {overdueCount} atrasado{overdueCount > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" asChild className="gap-1 text-muted-foreground">
            <Link to="/agenda">
              Agenda <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>

        {deadlines.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum compromisso nos próximos 7 dias 🎉
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {deadlines.map((d) => {
              const DIcon = typeIcons[d.title] || CalendarClock;
              return (
                <button
                  key={d.id}
                  onClick={() => d.type === "appointment" ? openDetail(d) : undefined}
                  className={`block w-full text-left rounded-lg border p-3 hover:border-accent/30 transition-all cursor-pointer ${
                    d.overdue ? "border-l-4 border-l-destructive bg-destructive/5" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <DIcon className="w-4 h-4 text-accent shrink-0" />
                      <p className="text-sm text-foreground font-medium line-clamp-1">{d.title}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0 ml-2">
                      {d.type === "appointment" ? "Compromisso" : "Tarefa CRM"}
                    </Badge>
                  </div>
                  {d.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1 pl-6">{d.description}</p>
                  )}
                  <p className={`text-xs mt-1 pl-6 ${d.overdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                    {new Date(d.due).toLocaleDateString("pt-BR", {
                      weekday: "short",
                      day: "2-digit",
                      month: "short",
                      hour: d.type === "appointment" ? "2-digit" : undefined,
                      minute: d.type === "appointment" ? "2-digit" : undefined,
                    })}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Appointment detail dialog */}
      <Dialog open={!!selectedDeadline} onOpenChange={(open) => { if (!open) setSelectedDeadline(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="w-5 h-5 text-accent" />
              {editing ? "Editar Compromisso" : "Detalhes do Compromisso"}
            </DialogTitle>
            <DialogDescription>
              {editing ? "Edite as informações abaixo" : "Visualize ou edite este compromisso"}
            </DialogDescription>
          </DialogHeader>

          {selectedDeadline && !editing && (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Tipo</p>
                <p className="text-sm text-foreground font-medium mt-0.5">{selectedDeadline.title}</p>
              </div>
              {selectedDeadline.description && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Descrição</p>
                  <p className="text-sm text-foreground mt-0.5">{selectedDeadline.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Data</p>
                  <p className="text-sm text-foreground mt-0.5">
                    {new Date(selectedDeadline.due).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Horário</p>
                  <p className="text-sm text-foreground mt-0.5 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-accent" />
                    {new Date(selectedDeadline.due).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    {selectedDeadline.endAt && (
                      <> — {new Date(selectedDeadline.endAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</>
                    )}
                  </p>
                </div>
              </div>
              {selectedDeadline.caseId && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Processo vinculado</p>
                  <Link to={`/processos/${selectedDeadline.caseId}`} className="text-sm text-accent hover:underline mt-0.5 inline-block">
                    Ver processo →
                  </Link>
                </div>
              )}
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

          {selectedDeadline && editing && (
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
    </>
  );
};

export default DashboardDeadlines;
