import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { History, UserCheck, FileText, MessageSquare, RefreshCw, Pencil, Plus, Settings } from "lucide-react";

interface Activity {
  id: string;
  action_type: string;
  description: string;
  user_id: string | null;
  metadata: any;
  created_at: string;
}

const actionTypeConfig: Record<string, { label: string; icon: typeof History; color: string }> = {
  substabelecimento: { label: "Substabelecimento", icon: UserCheck, color: "text-accent" },
  document_upload: { label: "Documento", icon: FileText, color: "text-blue-500" },
  movement_added: { label: "Movimentação", icon: RefreshCw, color: "text-green-500" },
  message_sent: { label: "Mensagem", icon: MessageSquare, color: "text-purple-500" },
  case_edited: { label: "Edição", icon: Pencil, color: "text-orange-500" },
  case_created: { label: "Cadastro", icon: Plus, color: "text-emerald-500" },
  access_changed: { label: "Acesso", icon: Settings, color: "text-red-500" },
};

interface CaseActivityLogProps {
  caseId: string;
}

const CaseActivityLog = ({ caseId }: CaseActivityLogProps) => {
  const { tenantId } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    loadData();
  }, [tenantId, caseId]);

  const loadData = async () => {
    if (!tenantId) return;

    const [activitiesRes, profilesRes] = await Promise.all([
      supabase.from("case_activities").select("*").eq("case_id", caseId).order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, full_name").eq("tenant_id", tenantId),
    ]);

    const pMap: Record<string, string> = {};
    (profilesRes.data || []).forEach((p) => { pMap[p.user_id] = p.full_name; });
    setProfileMap(pMap);

    setActivities((activitiesRes.data || []) as Activity[]);
    setLoading(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground py-4">Carregando...</p>;

  if (activities.length === 0) {
    return (
      <div className="text-center py-10">
        <History className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Nenhuma atividade registrada neste processo.</p>
        <p className="text-xs text-muted-foreground mt-1">As atividades serão registradas automaticamente a partir de agora.</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {activities.map((activity, i) => {
        const config = actionTypeConfig[activity.action_type] || { label: activity.action_type, icon: History, color: "text-muted-foreground" };
        const IconComponent = config.icon;

        return (
          <motion.div
            key={activity.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="relative pl-8 pb-5 last:pb-0"
          >
            {i < activities.length - 1 && <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />}
            <div className="absolute left-0 top-1 w-[22px] h-[22px] rounded-full border-2 border-border bg-card flex items-center justify-center">
              <IconComponent className={`w-3 h-3 ${config.color}`} />
            </div>
            <div className="bg-card rounded-lg border p-4 shadow-card">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {config.label}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(activity.created_at).toLocaleString("pt-BR")}
                </span>
              </div>
              <p className="text-sm text-foreground">{activity.description}</p>
              {activity.user_id && (
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Por: {profileMap[activity.user_id] || activity.user_id}
                </p>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default CaseActivityLog;
