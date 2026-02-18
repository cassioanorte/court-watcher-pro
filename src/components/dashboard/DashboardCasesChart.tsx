import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface MonthData {
  month: string;
  count: number;
}

const DashboardCasesChart = () => {
  const { tenantId } = useAuth();
  const [data, setData] = useState<MonthData[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      sixMonthsAgo.setDate(1);

      const { data: cases } = await supabase
        .from("cases")
        .select("created_at")
        .eq("tenant_id", tenantId)
        .gte("created_at", sixMonthsAgo.toISOString());

      if (!cases) return;

      const months: Record<string, number> = {};
      for (let i = 0; i < 6; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() - (5 - i));
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        months[key] = 0;
      }

      cases.forEach((c) => {
        const d = new Date(c.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (key in months) months[key]++;
      });

      const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      setData(
        Object.entries(months).map(([key, count]) => ({
          month: MONTH_NAMES[parseInt(key.split("-")[1]) - 1],
          count,
        }))
      );
    };
    load();
  }, [tenantId]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="bg-card rounded-xl border shadow-card p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-accent" />
        <h2 className="font-semibold text-foreground">Processos Cadastrados</h2>
        <span className="text-xs text-muted-foreground">últimos 6 meses</span>
      </div>

      {data.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
          Carregando...
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} barSize={32}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(220 15% 90%)" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(220 10% 50%)" }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "hsl(220 10% 50%)" }} axisLine={false} tickLine={false} width={30} />
            <Tooltip
              contentStyle={{
                background: "hsl(220 40% 20%)",
                border: "none",
                borderRadius: 8,
                color: "#fff",
                fontSize: 12,
              }}
              formatter={(value: number) => [`${value} processos`, ""]}
              labelFormatter={(label) => label}
            />
            <Bar dataKey="count" fill="hsl(38 80% 55%)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
};

export default DashboardCasesChart;
