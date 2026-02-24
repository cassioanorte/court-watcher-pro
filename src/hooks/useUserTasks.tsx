import { useEffect, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface UserTask {
  id: string;
  tenant_id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  case_id: string | null;
  completed: boolean;
  completed_at: string | null;
  position: number;
  created_at: string;
  subtasks?: UserTaskSubtask[];
}

export interface UserTaskSubtask {
  id: string;
  task_id: string;
  tenant_id: string;
  title: string;
  completed: boolean;
  completed_at: string | null;
  position: number;
  created_at: string;
}

export interface CaseOption {
  id: string;
  process_number: string;
  parties: string | null;
}

export const PREDEFINED_TASKS = [
  { category: "Processuais", tasks: [
    "Fazer petição",
    "Cumprir despacho",
    "Protocolar recurso",
    "Juntar documentos",
    "Analisar processo",
    "Fazer cumprimento de sentença",
    "Fazer contrarrazões",
    "Fazer réplica",
    "Fazer manifestação",
  ]},
  { category: "Atendimento", tasks: [
    "Ligar para cliente",
    "Agendar reunião",
    "Responder e-mail",
    "Enviar documentos ao cliente",
    "Agendar perícia",
  ]},
  { category: "Administrativas", tasks: [
    "Cobrar honorários",
    "Emitir nota fiscal",
    "Atualizar cadastro",
    "Fazer lista de RPV/precatórios",
    "Protocolar alvará",
  ]},
];

export function useUserTasks() {
  const { user, tenantId } = useAuth();
  const [tasks, setTasks] = useState<UserTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<CaseOption[]>([]);

  const fetchTasks = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("user_tasks" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("completed", { ascending: true })
      .order("position", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(200);

    const taskList = (data || []) as unknown as UserTask[];

    // Fetch subtasks for all tasks
    if (taskList.length > 0) {
      const taskIds = taskList.map(t => t.id);
      const { data: subs } = await supabase
        .from("user_task_subtasks" as any)
        .select("*")
        .in("task_id", taskIds)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });

      const subtaskMap: Record<string, UserTaskSubtask[]> = {};
      ((subs || []) as unknown as UserTaskSubtask[]).forEach(s => {
        if (!subtaskMap[s.task_id]) subtaskMap[s.task_id] = [];
        subtaskMap[s.task_id].push(s);
      });

      taskList.forEach(t => { t.subtasks = subtaskMap[t.id] || []; });
    }

    setTasks(taskList);
    setLoading(false);
  }, [user?.id]);

  const fetchCases = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from("cases")
      .select("id, process_number, parties")
      .eq("tenant_id", tenantId)
      .eq("archived", false)
      .order("process_number")
      .limit(200);
    setCases((data || []) as CaseOption[]);
  }, [tenantId]);

  useEffect(() => {
    fetchTasks();
    fetchCases();
  }, [fetchTasks, fetchCases]);

  const addTask = useCallback(async (title: string, opts?: { description?: string; due_date?: string; due_time?: string; case_id?: string }) => {
    if (!user?.id || !tenantId) return;
    const { error } = await supabase.from("user_tasks" as any).insert({
      tenant_id: tenantId,
      user_id: user.id,
      title: title.trim(),
      description: opts?.description?.trim() || null,
      due_date: opts?.due_date || null,
      due_time: opts?.due_time || null,
      case_id: opts?.case_id || null,
    });
    if (!error) await fetchTasks();
    return error;
  }, [user?.id, tenantId, fetchTasks]);

  const toggleTask = useCallback(async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const newCompleted = !task.completed;
    await supabase.from("user_tasks" as any).update({
      completed: newCompleted,
      completed_at: newCompleted ? new Date().toISOString() : null,
    }).eq("id", taskId);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null } : t));
  }, [tasks]);

  const deleteTask = useCallback(async (taskId: string) => {
    await supabase.from("user_tasks" as any).delete().eq("id", taskId);
    setTasks(prev => prev.filter(t => t.id !== taskId));
  }, []);

  const updateTask = useCallback(async (taskId: string, updates: Partial<Pick<UserTask, "title" | "description" | "due_date" | "due_time" | "case_id">>) => {
    await supabase.from("user_tasks" as any).update(updates).eq("id", taskId);
    await fetchTasks();
  }, [fetchTasks]);

  // Subtask operations
  const addSubtask = useCallback(async (taskId: string, title: string) => {
    if (!tenantId) return;
    await supabase.from("user_task_subtasks" as any).insert({
      task_id: taskId,
      tenant_id: tenantId,
      title: title.trim(),
    });
    await fetchTasks();
  }, [tenantId, fetchTasks]);

  const toggleSubtask = useCallback(async (subtaskId: string) => {
    const allSubs = tasks.flatMap(t => t.subtasks || []);
    const sub = allSubs.find(s => s.id === subtaskId);
    if (!sub) return;
    const newCompleted = !sub.completed;
    await supabase.from("user_task_subtasks" as any).update({
      completed: newCompleted,
      completed_at: newCompleted ? new Date().toISOString() : null,
    }).eq("id", subtaskId);
    await fetchTasks();
  }, [tasks, fetchTasks]);

  const deleteSubtask = useCallback(async (subtaskId: string) => {
    await supabase.from("user_task_subtasks" as any).delete().eq("id", subtaskId);
    await fetchTasks();
  }, [fetchTasks]);

  const activeTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  return {
    tasks, activeTasks, completedTasks, loading, cases,
    addTask, toggleTask, deleteTask, updateTask,
    addSubtask, toggleSubtask, deleteSubtask,
    refetch: fetchTasks,
  };
}
