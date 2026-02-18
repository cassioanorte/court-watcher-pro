import { motion } from "framer-motion";
import { Scale, Users, CalendarDays, LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

interface StatCard {
  label: string;
  value: number;
  icon: LucideIcon;
  link: string;
  gradient: string;
  iconBg: string;
}

interface Props {
  casesCount: number;
  clientsCount: number;
  appointmentsCount: number;
  loading: boolean;
}

const DashboardStatsCards = ({ casesCount, clientsCount, appointmentsCount, loading }: Props) => {
  const stats: StatCard[] = [
    {
      label: "Processos Ativos",
      value: casesCount,
      icon: Scale,
      link: "/processos",
      gradient: "from-[hsl(220,40%,20%)] to-[hsl(220,35%,30%)]",
      iconBg: "bg-accent/20",
    },
    {
      label: "Contatos",
      value: clientsCount,
      icon: Users,
      link: "/contatos",
      gradient: "from-[hsl(152,60%,35%)] to-[hsl(152,50%,45%)]",
      iconBg: "bg-[hsl(152,60%,42%)]/20",
    },
    {
      label: "Compromissos da Semana",
      value: appointmentsCount,
      icon: CalendarDays,
      link: "/agenda",
      gradient: "from-[hsl(38,80%,45%)] to-[hsl(38,70%,55%)]",
      iconBg: "bg-accent/20",
    },
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
            className={`relative block overflow-hidden rounded-xl p-5 bg-gradient-to-br ${stat.gradient} text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300`}
          >
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-white/5 -translate-y-6 translate-x-6" />
            <div className="absolute bottom-0 left-0 w-16 h-16 rounded-full bg-white/5 translate-y-4 -translate-x-4" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-11 h-11 rounded-lg ${stat.iconBg} backdrop-blur-sm flex items-center justify-center`}>
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className="text-3xl font-bold tracking-tight font-display">
                {loading ? "–" : stat.value}
              </p>
              <p className="text-xs text-white/70 mt-1 font-medium uppercase tracking-wide">
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
