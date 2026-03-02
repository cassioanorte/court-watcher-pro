import { useState, useEffect, useCallback } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";

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
    <DropdownMenu open={open} onOpenChange={(o) => { setOpen(o); if (o) fetchNotifs(); }}>
      <DropdownMenuTrigger asChild>
        <button className="relative text-muted-foreground hover:text-foreground transition-colors focus:outline-none">
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 bg-popover z-[100]">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notificações</span>
          {unread > 0 && (
            <button onClick={markAllRead} className="text-xs text-primary hover:underline">
              Marcar todas como lidas
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma notificação</p>
        ) : (
          <ScrollArea className="max-h-72">
            <div className="divide-y divide-border">
              {items.map((n) => (
                <div key={n.id} className={`px-3 py-2.5 ${!n.read ? "bg-accent/10" : ""}`}>
                  <p className="text-sm font-medium text-foreground line-clamp-1">{n.title}</p>
                  {n.body && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>}
                  <span className="text-[10px] text-muted-foreground mt-1 block">
                    {new Date(n.created_at).toLocaleDateString("pt-BR")} {new Date(n.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationBell;
