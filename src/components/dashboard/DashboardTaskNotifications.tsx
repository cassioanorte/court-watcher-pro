import { useState } from "react";
import { motion } from "framer-motion";
import { Bell, SendHorizonal, AlertTriangle, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTaskNotifications, type TaskAssignment } from "@/hooks/useTaskNotifications";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

const DashboardTaskNotifications = () => {
  const { receivedTasks, delegatedTasks, loading, unreadCount, markComplete, markIncomplete } = useTaskNotifications();
  const { tenantId } = useAuth();
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});

  // Fetch team member names for delegated tasks
  useEffect(() => {
    if (!tenantId) return;
    const userIds = new Set([
      ...delegatedTasks.map((t) => t.assigned_to),
      ...receivedTasks.map((t) => t.assigned_by),
    ]);
    if (userIds.size === 0) return;
    supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", Array.from(userIds))
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data || []).forEach((p) => { map[p.user_id] = p.full_name; });
        setTeamNames(map);
      });
  }, [tenantId, delegatedTasks, receivedTasks]);

  const isOverdue = (task: TaskAssignment) => {
    if (!task.due_date || task.completed) return false;
    return new Date(task.due_date + "T23:59:59") < new Date();
  };

  const pendingDelegated = delegatedTasks.filter((t) => !t.completed).length;

  const TaskItem = ({ task, showAssignee, showAssigner }: { task: TaskAssignment; showAssignee?: boolean; showAssigner?: boolean }) => (
    <div
      className={`flex items-start gap-3 rounded-md border p-3 transition-all ${
        isOverdue(task)
          ? "border-l-4 border-l-destructive bg-destructive/5"
          : !task.completed
          ? "border-l-4 border-l-accent bg-accent/5"
          : "opacity-70"
      }`}
    >
      <Checkbox
        checked={task.completed}
        onCheckedChange={(checked) => {
          if (checked) markComplete(task.id);
          else markIncomplete(task.id);
        }}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm line-clamp-2 ${task.completed ? "text-muted-foreground line-through" : "text-foreground font-medium"}`}>
          {task.task_description}
        </p>
        {task.process_number && (
          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{task.process_number}</p>
        )}
        {task.parties && (
          <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{task.parties}</p>
        )}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {task.due_date && (
            <span className={`text-[10px] flex items-center gap-0.5 ${isOverdue(task) ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
              {isOverdue(task) ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              {new Date(task.due_date + "T12:00:00").toLocaleDateString("pt-BR")}
            </span>
          )}
          {showAssignee && teamNames[task.assigned_to] && (
            <span className="text-[10px] text-accent">→ {teamNames[task.assigned_to]}</span>
          )}
          {showAssigner && teamNames[task.assigned_by] && (
            <span className="text-[10px] text-muted-foreground">por {teamNames[task.assigned_by]}</span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {new Date(task.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
          </span>
          {task.case_id && (
            <Link to={`/processos/${task.case_id}`} className="text-[10px] text-accent hover:underline">
              Ver processo
            </Link>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
      <div className="bg-card rounded-xl border shadow-card p-5">
        <Tabs defaultValue="received" className="w-full">
          <div className="flex items-center justify-between mb-4">
            <TabsList className="h-8">
              <TabsTrigger value="received" className="text-xs gap-1.5 px-3">
                <Bell className="w-3.5 h-3.5" />
                Tarefas Atribuídas
                {unreadCount > 0 && <Badge variant="destructive" className="text-[10px] h-4 px-1.5 ml-1">{unreadCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="delegated" className="text-xs gap-1.5 px-3">
                <SendHorizonal className="w-3.5 h-3.5" />
                Tarefas Delegadas
                {pendingDelegated > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-1">{pendingDelegated}</Badge>}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="received" className="mt-0">
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
            ) : receivedTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tarefa atribuída a você</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {receivedTasks.map((task) => (
                  <TaskItem key={task.id} task={task} showAssigner />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="delegated" className="mt-0">
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
            ) : delegatedTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tarefa delegada por você</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {delegatedTasks.map((task) => (
                  <TaskItem key={task.id} task={task} showAssignee />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </motion.div>
  );
};

export default DashboardTaskNotifications;
