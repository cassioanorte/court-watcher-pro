import { useEffect, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface TaskAssignment {
  id: string;
  case_id: string | null;
  assigned_by: string;
  assigned_to: string;
  task_description: string;
  process_number: string | null;
  parties: string | null;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export function useTaskNotifications() {
  const { user } = useAuth();
  const [receivedTasks, setReceivedTasks] = useState<TaskAssignment[]>([]);
  const [delegatedTasks, setDelegatedTasks] = useState<TaskAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!user?.id) return;
    const [receivedRes, delegatedRes] = await Promise.all([
      supabase
        .from("task_assignments" as any)
        .select("*")
        .eq("assigned_to", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("task_assignments" as any)
        .select("*")
        .eq("assigned_by", user.id)
        .neq("assigned_to", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setReceivedTasks((receivedRes.data || []) as unknown as TaskAssignment[]);
    setDelegatedTasks((delegatedRes.data || []) as unknown as TaskAssignment[]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Realtime subscription for popup on new task assigned to me
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`task-assignments-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "task_assignments",
          filter: `assigned_to=eq.${user.id}`,
        },
        (payload) => {
          const newTask = payload.new as TaskAssignment;
          if (newTask.assigned_by !== user.id) {
            toast.info(`Nova tarefa: ${newTask.task_description}`, {
              description: `Processo: ${newTask.process_number || "—"}${newTask.due_date ? ` | Prazo: ${new Date(newTask.due_date + "T12:00:00").toLocaleDateString("pt-BR")}` : ""}`,
              duration: 8000,
            });
          }
          setReceivedTasks((prev) => [newTask, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_assignments",
          filter: `assigned_by=eq.${user.id}`,
        },
        () => {
          // Refetch delegated tasks on any change
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchTasks]);

  const markComplete = useCallback(async (taskId: string) => {
    await supabase
      .from("task_assignments" as any)
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq("id", taskId);
    const updateList = (prev: TaskAssignment[]) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: true, completed_at: new Date().toISOString() } : t));
    setReceivedTasks(updateList);
    setDelegatedTasks(updateList);
  }, []);

  const markIncomplete = useCallback(async (taskId: string) => {
    await supabase
      .from("task_assignments" as any)
      .update({ completed: false, completed_at: null })
      .eq("id", taskId);
    const updateList = (prev: TaskAssignment[]) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: false, completed_at: null } : t));
    setReceivedTasks(updateList);
    setDelegatedTasks(updateList);
  }, []);

  const unreadCount = receivedTasks.filter((t) => !t.completed).length;

  return { receivedTasks, delegatedTasks, loading, unreadCount, markComplete, markIncomplete, refetch: fetchTasks };
}
