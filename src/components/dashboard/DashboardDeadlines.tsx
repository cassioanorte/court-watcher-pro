import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { CalendarClock, AlertTriangle, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Deadline {
  id: string;
  title: string;
  due: string;
  type: "appointment" | "crm_task";
  link: string;
  overdue: boolean;
}

const DashboardDeadlines = () => {
  const { tenantId } = useAuth();
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      const now = new Date();
      const in7days = new Date();
      in7days.setDate(in7days.getDate() + 7);

      const [aptsRes, tasksRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("id, title, start_at, case_id")
          .eq("tenant_id", tenantId)
          .gte("start_at", now.toISOString())
          .lte("start_at", in7days.toISOString())
          .order("start_at")
          .limit(5),
        supabase
          .from("crm_tasks")
          .select("id, title, due_date, lead_id")
          .eq("tenant_id", tenantId)
          .eq("completed", false)
          .lte("due_date", in7days.toISOString().split("T")[0])
          .order("due_date")
          .limit(5),
      ]);

      const items: Deadline[] = [];
      (aptsRes.data || []).forEach((a) =>
        items.push({
          id: a.id,
          title: a.title,
          due: a.start_at,
          type: "appointment",
          link: "/agenda",
          overdue: new Date(a.start_at) < now,
        })
      );
      (tasksRes.data || []).forEach((t) =>
        items.push({
          id: t.id,
          title: t.title,
          due: t.due_date,
          type: "crm_task",
          link: "/crm",
          overdue: new Date(t.due_date) < new Date(now.toISOString().split("T")[0]),
        })
      );

      items.sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());
      setDeadlines(items.slice(0, 8));
    };
    load();
  }, [tenantId]);

  const overdueCount = deadlines.filter((d) => d.overdue).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-card rounded-xl border shadow-card p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-accent" />
          <h2 className="font-semibold text-foreground">Próximos Prazos</h2>
          {overdueCount > 0 && (
            <Badge variant="destructive" className="text-xs gap-1">
              <AlertTriangle className="w-3 h-3" /> {overdueCount} atrasado{overdueCount > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" asChild className="gap-1 text-muted-foreground">
          <Link to="/agenda">
            Agenda <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>

      {deadlines.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum prazo nos próximos 7 dias 🎉
        </p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {deadlines.map((d) => (
            <Link
              key={d.id}
              to={d.link}
              className={`block rounded-lg border p-3 hover:border-accent/30 transition-all ${
                d.overdue ? "border-l-4 border-l-destructive bg-destructive/5" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-foreground font-medium line-clamp-1">{d.title}</p>
                <Badge variant="outline" className="text-[10px] shrink-0 ml-2">
                  {d.type === "appointment" ? "Compromisso" : "Tarefa CRM"}
                </Badge>
              </div>
              <p className={`text-xs mt-1 ${d.overdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                {new Date(d.due).toLocaleDateString("pt-BR", {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                  hour: d.type === "appointment" ? "2-digit" : undefined,
                  minute: d.type === "appointment" ? "2-digit" : undefined,
                })}
              </p>
            </Link>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default DashboardDeadlines;
