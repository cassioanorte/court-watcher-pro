import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Mail, Calendar, FileText } from "lucide-react";

interface ClientNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  metadata: any;
  sent_by: string | null;
  created_at: string;
}

const typeIcons: Record<string, typeof Mail> = {
  email: Mail,
  agendamento: Calendar,
  documento: FileText,
};

const typeLabels: Record<string, string> = {
  email: "E-mail",
  agendamento: "Agendamento",
  documento: "Documento",
};

interface Props {
  contactUserId: string;
  tenantId: string;
}

const ContactNotifications = ({ contactUserId, tenantId }: Props) => {
  const [notifications, setNotifications] = useState<ClientNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [senderNames, setSenderNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("client_notifications" as any)
        .select("*")
        .eq("client_user_id", contactUserId)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(100);

      const items = (data || []) as unknown as ClientNotification[];
      setNotifications(items);

      // Fetch sender names
      const senderIds = [...new Set(items.map((n) => n.sent_by).filter(Boolean))] as string[];
      if (senderIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", senderIds);
        const map: Record<string, string> = {};
        (profiles || []).forEach((p) => { map[p.user_id] = p.full_name; });
        setSenderNames(map);
      }

      setLoading(false);
    };
    load();
  }, [contactUserId, tenantId]);

  if (loading) return <p className="text-sm text-muted-foreground p-4">Carregando notificações...</p>;

  if (notifications.length === 0) {
    return (
      <div className="bg-card border rounded-lg p-8 text-center">
        <Bell className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Nenhuma notificação enviada para este contato.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b">
        <h3 className="text-sm font-semibold text-foreground">Notificações Enviadas</h3>
        <p className="text-xs text-muted-foreground">{notifications.length} registro(s)</p>
      </div>
      <div className="divide-y">
        {notifications.map((n) => {
          const Icon = typeIcons[n.type] || Bell;
          return (
            <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium shrink-0">
                    {typeLabels[n.type] || n.type}
                  </span>
                </div>
                {n.body && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                )}
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(n.created_at).toLocaleDateString("pt-BR")} às{" "}
                    {new Date(n.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {n.sent_by && senderNames[n.sent_by] && (
                    <span className="text-[10px] text-muted-foreground">
                      por {senderNames[n.sent_by]}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ContactNotifications;
