import { useState, useEffect, useCallback } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface Notif {
  id: string;
  title: string;
  body: string | null;
  read: boolean | null;
  created_at: string;
  case_id: string | null;
}

const NotificationBell = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);

  const fetchNotifs = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("notifications")
      .select("id, title, body, read, created_at, case_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setItems((data || []) as Notif[]);
  }, [user?.id]);

  useEffect(() => {
    fetchNotifs();
  }, [fetchNotifs]);

  useEffect(() => {
    if (open) fetchNotifs();
  }, [open, fetchNotifs]);

  const unread = items.filter((n) => !n.read).length;

  const markAllRead = async () => {
    if (!user?.id || unread === 0) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative text-muted-foreground hover:text-foreground transition-colors focus:outline-none">
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 z-[100]">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="text-sm font-semibold text-foreground">Notificações</h4>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-primary" onClick={markAllRead}>
              <CheckCheck className="w-3.5 h-3.5" />
              Marcar lidas
            </Button>
          )}
        </div>
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4">
            <Bell className="w-8 h-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Quando houver alertas, eles aparecerão aqui.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-72">
            <div className="divide-y divide-border">
              {items.map((n) => (
                <div key={n.id} className={`px-4 py-3 transition-colors ${!n.read ? "bg-accent/10" : "hover:bg-muted/30"}`}>
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground line-clamp-1">{n.title}</p>
                      {n.body && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>}
                      <span className="text-[10px] text-muted-foreground mt-1 block">
                        {new Date(n.created_at).toLocaleDateString("pt-BR")} às{" "}
                        {new Date(n.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
