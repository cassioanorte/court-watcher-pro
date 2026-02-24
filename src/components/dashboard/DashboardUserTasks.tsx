import { useState } from "react";
import { motion } from "framer-motion";
import { CheckSquare, Plus, Check, Trash2, CalendarDays, ChevronDown, ChevronRight, Briefcase, ListPlus, Edit2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUserTasks, PREDEFINED_TASKS, type UserTask } from "@/hooks/useUserTasks";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const DashboardUserTasks = () => {
  const { activeTasks, completedTasks, loading, toggleTask, deleteTask, addTask, updateTask, cases } = useUserTasks();
  const [newTitle, setNewTitle] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [showPredefined, setShowPredefined] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingTask, setEditingTask] = useState<UserTask | null>(null);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    setAdding(true);
    const err = await addTask(newTitle);
    if (err) toast.error("Erro ao criar tarefa");
    else { setNewTitle(""); toast.success("Tarefa criada!"); }
    setAdding(false);
  };

  const handlePredefined = (title: string) => {
    setNewTitle(title);
    setShowPredefined(false);
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

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card rounded-xl border shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-accent" />
          <h2 className="font-semibold text-foreground">Minhas Tarefas</h2>
          {activeTasks.length > 0 && (
            <Badge variant="default" className="text-xs">{activeTasks.length}</Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Popover open={showPredefined} onOpenChange={setShowPredefined}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">
                <ListPlus className="w-3.5 h-3.5" /> Sugestões
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2 max-h-72 overflow-y-auto" align="end">
              {PREDEFINED_TASKS.map(cat => (
                <div key={cat.category} className="mb-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">{cat.category}</p>
                  {cat.tasks.map(t => (
                    <button
                      key={t}
                      onClick={() => handlePredefined(t)}
                      className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-accent/10 transition-colors"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              ))}
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="sm" asChild className="gap-1 text-xs h-7">
            <Link to="/tarefas">Ver todas</Link>
          </Button>
        </div>
      </div>

      {/* Quick add */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1 relative">
          <Input
            placeholder="Adicionar uma tarefa..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="pr-8 h-9 text-sm"
          />
          {newTitle.trim() && (
            <button onClick={handleAdd} disabled={adding} className="absolute right-2 top-1/2 -translate-y-1/2 text-accent hover:text-accent/80">
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
      ) : activeTasks.length === 0 && !showCompleted ? (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tarefa pendente 🎉</p>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {activeTasks.slice(0, 10).map((t) => {
            const overdue = isOverdue(t);
            return (
              <div key={t.id} className={`flex items-start gap-2 rounded-lg border p-2.5 transition-all ${overdue ? "border-l-4 border-l-destructive bg-destructive/5" : ""}`}>
                <button onClick={() => toggleTask(t.id)} className="mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 border-muted-foreground/40 hover:border-accent flex items-center justify-center transition-colors" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground font-medium line-clamp-1">{t.title}</p>
                  {t.description && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{t.description}</p>}
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {t.due_date && (
                      <span className={`text-[10px] flex items-center gap-0.5 ${overdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                        <CalendarDays className="w-3 h-3" />
                        {new Date(t.due_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                        {t.due_time && ` ${t.due_time.slice(0, 5)}`}
                      </span>
                    )}
                    {t.subtasks && t.subtasks.length > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {t.subtasks.filter(s => s.completed).length}/{t.subtasks.length} subtarefas
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => setEditingTask({ ...t })} className="p-1 text-muted-foreground hover:text-accent shrink-0">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => { deleteTask(t.id); toast.success("Tarefa excluída"); }} className="p-1 text-muted-foreground hover:text-destructive shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
          {activeTasks.length > 10 && (
            <Link to="/tarefas" className="block text-center text-xs text-accent hover:underline py-1">
              +{activeTasks.length - 10} tarefas...
            </Link>
          )}
        </div>
      )}

      {completedTasks.length > 0 && (
        <div className="mt-3">
          <button onClick={() => setShowCompleted(!showCompleted)} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            {showCompleted ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Concluídas ({completedTasks.length})
          </button>
          {showCompleted && (
            <div className="space-y-1 mt-2">
              {completedTasks.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-lg border p-2 opacity-60">
                  <button onClick={() => toggleTask(t.id)} className="shrink-0 w-5 h-5 rounded-full border-2 border-accent bg-accent/20 flex items-center justify-center">
                    <Check className="w-3 h-3 text-accent" />
                  </button>
                  <p className="text-xs text-muted-foreground line-through flex-1 line-clamp-1">{t.title}</p>
                  <button onClick={() => { deleteTask(t.id); toast.success("Tarefa excluída"); }} className="p-1 text-muted-foreground hover:text-destructive shrink-0">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {completedTasks.length > 5 && (
                <Link to="/tarefas" className="block text-center text-xs text-accent hover:underline py-1">
                  Ver todas concluídas
                </Link>
              )}
            </div>
          )}
        </div>
      )}

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
    </motion.div>
  );
};

export default DashboardUserTasks;
