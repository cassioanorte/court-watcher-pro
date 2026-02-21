import { motion } from "framer-motion";
import { Bell, Check, Undo2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useTaskNotifications } from "@/hooks/useTaskNotifications";

const DashboardTaskNotifications = () => {
  const { notifications, loading, unreadCount, markAsRead, markAsUnread } = useTaskNotifications();

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
      <div className="bg-card rounded-xl border shadow-card p-5 h-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-accent" />
            <h2 className="font-semibold text-foreground">Tarefas Atribuídas</h2>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs">{unreadCount}</Badge>
            )}
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
        ) : notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tarefa atribuída</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`flex items-start gap-3 rounded-md border p-3 transition-all ${
                  !notif.read ? "border-l-4 border-l-accent bg-accent/5" : "opacity-70"
                }`}
              >
                <Checkbox
                  checked={notif.read}
                  onCheckedChange={(checked) => {
                    if (checked) markAsRead(notif.id);
                    else markAsUnread(notif.id);
                  }}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm line-clamp-2 ${notif.read ? "text-muted-foreground line-through" : "text-foreground font-medium"}`}>
                    {notif.title}
                  </p>
                  {notif.body && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{notif.body}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(notif.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {notif.case_id && (
                      <Link to={`/processos/${notif.case_id}`} className="text-[10px] text-accent hover:underline">
                        Ver processo
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default DashboardTaskNotifications;
