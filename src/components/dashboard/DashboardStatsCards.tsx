import { motion } from "framer-motion";
import { Bot, Users, CalendarDays, LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

interface StatCard {
  label: string;
  value: number;
  icon: LucideIcon;
  link: string;
  color: string; // tailwind color prefix e.g. "purple", "emerald", "orange"
}

interface Props {
  agentsCount: number;
  clientsCount: number;
  appointmentsCount: number;
  loading: boolean;
}

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; glow: string; hoverBg: string; line: string }> = {
  purple: {
    bg: "bg-purple-500/10", border: "border-purple-500/20", text: "text-purple-400",
    glow: "hover:shadow-[0_0_30px_hsl(270_60%_50%/0.15)]", hoverBg: "group-hover:bg-purple-500/20",
    line: "via-purple-500/50",
  },
  emerald: {
    bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400",
    glow: "hover:shadow-[0_0_30px_hsl(152_60%_42%/0.15)]", hoverBg: "group-hover:bg-emerald-500/20",
    line: "via-emerald-500/50",
  },
  orange: {
    bg: "bg-orange-500/10", border: "border-orange-500/20", text: "text-orange-400",
    glow: "hover:shadow-[0_0_30px_hsl(25_90%_50%/0.15)]", hoverBg: "group-hover:bg-orange-500/20",
    line: "via-orange-500/50",
  },
};

const DashboardStatsCards = ({ agentsCount, clientsCount, appointmentsCount, loading }: Props) => {
  const stats: StatCard[] = [
    { label: "Agentes de IA", value: agentsCount, icon: Bot, link: "/agentes-ia", color: "purple" },
    { label: "Contatos", value: clientsCount, icon: Users, link: "/contatos", color: "emerald" },
    { label: "Compromissos da Semana", value: appointmentsCount, icon: CalendarDays, link: "/agenda", color: "orange" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, duration: 0.4 }}
        >
          <Link
            to={stat.link}
            className="relative block overflow-hidden rounded-xl p-5 bg-card border border-border shadow-card hover:shadow-gold-glow hover:border-primary/30 hover:scale-[1.02] transition-all duration-300 group"
          >
            {/* Subtle gold accent line at top */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />
            {/* Corner glow */}
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-primary/5 -translate-y-8 translate-x-8 group-hover:bg-primary/10 transition-colors" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="w-11 h-11 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <stat.icon className="w-5 h-5 text-primary" />
                </div>
              </div>
              <p className="text-3xl font-bold tracking-tight font-display text-foreground">
                {loading ? "–" : stat.value}
              </p>
              <p className="text-xs text-muted-foreground mt-1 font-medium uppercase tracking-wide">
                {stat.label}
              </p>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
};

export default DashboardStatsCards;
