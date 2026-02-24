import { useState } from "react";
import { motion } from "framer-motion";
import { CheckSquare, Plus, Check, Trash2, CalendarDays, ChevronDown, ChevronRight, Briefcase, ListPlus, MoreVertical, ChevronUp, Edit2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useUserTasks, PREDEFINED_TASKS, type UserTask } from "@/hooks/useUserTasks";
import { toast } from "sonner";

const Tarefas = () => {
  const {
    activeTasks, completedTasks, loading, cases,
    addTask, toggleTask, deleteTask, updateTask,
    addSubtask, toggleSubtask, deleteSubtask,
  } = useUserTasks();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [caseId, setCaseId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [editingTask, setEditingTask] = useState<UserTask | null>(null);
  const [showPredefined, setShowPredefined] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    const err = await addTask(title, {
      description: description.trim() || undefined,
      due_date: dueDate || undefined,
      due_time: dueTime || undefined,
      case_id: caseId && caseId !== "none" ? caseId : undefined,
    });
    if (err) toast.error("Erro ao criar tarefa");
    else {
      toast.success("Tarefa criada!");
      resetForm();
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setTitle(""); setDescription(""); setDueDate(""); setDueTime(""); setCaseId(""); setShowForm(false);
  };

  const handlePredefined = async (taskTitle: string) => {
    const err = await addTask(taskTitle);
    if (err) toast.error("Erro ao criar tarefa");
    else toast.success("Tarefa criada!");
    setShowPredefined(false);
  };

  const handleAddSubtask = async (taskId: string) => {
    if (!newSubtaskTitle.trim()) return;
    await addSubtask(taskId, newSubtaskTitle);
    setNewSubtaskTitle("");
  };

  const handleEditSave = async () => {
    if (!editingTask) return;
    await updateTask(editingTask.id, {
      title: editingTask.title,
      description: editingTask.description,
      due_date: editingTask.due_date,
      due_time: editingTask.due_time,
      case_id: editingTask.case_id,
    });
    toast.success("Tarefa atualizada!");
    setEditingTask(null);
  };

  const isOverdue = (t: { due_date: string | null; completed: boolean }) =>
    t.due_date && !t.completed && new Date(t.due_date + "T23:59:59") < new Date();

  const getCaseLabel = (cid: string) => cases.find(c => c.id === cid)?.process_number || "";

  const renderTask = (t: UserTask) => {
    const overdue = isOverdue(t);
    const isExpanded = expandedTask === t.id;
    const subtasksDone = t.subtasks?.filter(s => s.completed).length || 0;
    const subtasksTotal = t.subtasks?.length || 0;

    return (
      <div key={t.id} className={`rounded-xl border transition-all ${overdue ? "border-l-4 border-l-destructive bg-destructive/5" : "hover:border-accent/30"}`}>
        <div className="flex items-start gap-3 p-3">
          <button
            onClick={() => toggleTask(t.id)}
            className={`mt-1 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${t.completed ? "border-accent bg-accent/20" : "border-muted-foreground/40 hover:border-accent"}`}
          >
            {t.completed && <Check className="w-3 h-3 text-accent" />}
          </button>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${t.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.title}</p>
            {t.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{t.description}</p>}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {t.due_date && (
                <span className={`text-[10px] flex items-center gap-0.5 ${overdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                  <CalendarDays className="w-3 h-3" />
                  {new Date(t.due_date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
                  {t.due_time && `, ${t.due_time.slice(0, 5)}`}
                </span>
              )}
              {t.case_id && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <Briefcase className="w-3 h-3" />
                  {getCaseLabel(t.case_id)}
                </span>
              )}
              {subtasksTotal > 0 && (
                <span className="text-[10px] text-muted-foreground">{subtasksDone}/{subtasksTotal} subtarefas</span>
              )}
              {t.completed && t.completed_at && (
                <span className="text-[10px] text-muted-foreground">
                  Concluída em: {new Date(t.completed_at).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={() => setExpandedTask(isExpanded ? null : t.id)} className="p-1 text-muted-foreground hover:text-foreground">
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button onClick={() => setEditingTask({ ...t })} className="p-1 text-muted-foreground hover:text-accent">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => { deleteTask(t.id); toast.success("Tarefa excluída"); }} className="p-1 text-muted-foreground hover:text-destructive">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Subtasks */}
        {isExpanded && (
          <div className="px-3 pb-3 pl-11 space-y-1.5">
            {(t.subtasks || []).map(s => (
              <div key={s.id} className="flex items-center gap-2">
                <button
                  onClick={() => toggleSubtask(s.id)}
                  className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${s.completed ? "border-accent bg-accent/20" : "border-muted-foreground/40 hover:border-accent"}`}
                >
                  {s.completed && <Check className="w-2.5 h-2.5 text-accent" />}
                </button>
                <span className={`text-xs flex-1 ${s.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>{s.title}</span>
                <button onClick={() => deleteSubtask(s.id)} className="p-0.5 text-muted-foreground hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <div className="flex gap-1.5 mt-1">
              <Input
                placeholder="Adicionar subtarefa..."
                value={expandedTask === t.id ? newSubtaskTitle : ""}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSubtask(t.id)}
                className="h-7 text-xs"
              />
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => handleAddSubtask(t.id)} disabled={!newSubtaskTitle.trim()}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Minhas Tarefas</h1>
          <p className="text-sm text-muted-foreground mt-1">Sua lista pessoal de tarefas</p>
        </div>
        <div className="flex gap-2">
          <Popover open={showPredefined} onOpenChange={setShowPredefined}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <ListPlus className="w-4 h-4" /> Sugestões
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2 max-h-80 overflow-y-auto" align="end">
              {PREDEFINED_TASKS.map(cat => (
                <div key={cat.category} className="mb-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">{cat.category}</p>
                  {cat.tasks.map(t => (
                    <button key={t} onClick={() => handlePredefined(t)} className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-accent/10 transition-colors">
                      {t}
                    </button>
                  ))}
                </div>
              ))}
            </PopoverContent>
          </Popover>
          <Button size="sm" className="gap-1" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" /> Nova Tarefa
          </Button>
        </div>
      </div>

      {/* Quick add */}
      <div className="bg-card rounded-xl border p-4">
        <div className="flex gap-2">
          <Input
            placeholder="Adicionar uma tarefa rapidamente..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && title.trim()) {
                addTask(title).then(err => {
                  if (!err) { setTitle(""); toast.success("Tarefa criada!"); }
                });
              }
            }}
            className="h-10"
          />
        </div>
      </div>

      {loading ? (
        <div className="bg-card rounded-xl border p-8 text-center text-muted-foreground">Carregando...</div>
      ) : (
        <>
          {/* Active tasks */}
          <div className="space-y-2">
            {activeTasks.length === 0 ? (
              <div className="bg-card rounded-xl border p-8 text-center text-muted-foreground">
                Nenhuma tarefa pendente 🎉
              </div>
            ) : (
              activeTasks.map(renderTask)
            )}
          </div>

          {/* Completed tasks */}
          {completedTasks.length > 0 && (
            <div>
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
              >
                {showCompleted ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                Concluídas ({completedTasks.length})
              </button>
              {showCompleted && (
                <div className="space-y-2">
                  {completedTasks.map(renderTask)}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* New task dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input placeholder="Título da tarefa *" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea placeholder="Descrição / notas (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Prazo</label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Hora</label>
                <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
              </div>
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
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={resetForm}>Cancelar</Button>
              <Button size="sm" onClick={handleSubmit} disabled={!title.trim() || submitting}>
                {submitting ? "Criando..." : "Criar Tarefa"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit task dialog */}
      <Dialog open={!!editingTask} onOpenChange={() => setEditingTask(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Tarefa</DialogTitle>
          </DialogHeader>
          {editingTask && (
            <div className="space-y-3 mt-2">
              <Input value={editingTask.title} onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })} />
              <Textarea value={editingTask.description || ""} onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value || null })} rows={2} placeholder="Descrição" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Prazo</label>
                  <Input type="date" value={editingTask.due_date || ""} onChange={(e) => setEditingTask({ ...editingTask, due_date: e.target.value || null })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Hora</label>
                  <Input type="time" value={editingTask.due_time || ""} onChange={(e) => setEditingTask({ ...editingTask, due_time: e.target.value || null })} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Vincular processo</label>
                <Select value={editingTask.case_id || "none"} onValueChange={(v) => setEditingTask({ ...editingTask, case_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {cases.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.process_number}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setEditingTask(null)}>Cancelar</Button>
                <Button size="sm" onClick={handleEditSave}>Salvar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Tarefas;
