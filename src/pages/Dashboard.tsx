import { motion } from "framer-motion";
import { Scale, Users, AlertTriangle, TrendingUp, ArrowRight, Clock } from "lucide-react";
import { Link } from "react-router-dom";

const stats = [
  { label: "Processos Ativos", value: "47", icon: Scale, change: "+3 esta semana" },
  { label: "Clientes", value: "28", icon: Users, change: "+2 este mês" },
  { label: "Movimentações Hoje", value: "12", icon: TrendingUp, change: "6 novos" },
  { label: "Pendências", value: "3", icon: AlertTriangle, change: "Requer atenção" },
];

const recentMovements = [
  { process: "5001234-56.2024.8.21.0001", court: "TJRS - 1º Grau", title: "Decisão interlocutória publicada", time: "Há 2h", status: "new" },
  { process: "5009876-12.2024.4.04.7100", court: "TRF4 - JFRS", title: "Intimação eletrônica expedida", time: "Há 4h", status: "new" },
  { process: "5003456-78.2024.8.21.0001", court: "TJRS - 2º Grau", title: "Juntada de petição", time: "Há 6h", status: "read" },
  { process: "5007890-34.2024.4.04.7200", court: "TRF4 - JFSC", title: "Certidão de publicação expedida", time: "Há 8h", status: "read" },
  { process: "5002345-67.2024.8.21.0001", court: "TJRS - 1º Grau", title: "Ato ordinatório praticado", time: "Há 12h", status: "read" },
];

const Dashboard = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral do escritório</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="bg-card rounded-lg p-5 shadow-card border"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.label}</p>
                <p className="text-3xl font-bold text-foreground mt-1 font-display">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-accent/15 flex items-center justify-center">
                <stat.icon className="w-5 h-5 text-accent" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Recent movements */}
      <div className="bg-card rounded-lg shadow-card border">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-base font-semibold text-foreground">Movimentações Recentes</h2>
          <Link to="/processos" className="text-xs text-accent hover:underline flex items-center gap-1">
            Ver todos <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="divide-y">
          {recentMovements.map((mov, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.06 }}
              className="flex items-start gap-4 px-5 py-3.5 hover:bg-muted/50 transition-colors"
            >
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${mov.status === "new" ? "bg-accent" : "bg-muted-foreground/30"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{mov.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{mov.process}</p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{mov.court}</span>
                <p className="text-xs text-muted-foreground mt-1 flex items-center justify-end gap-1">
                  <Clock className="w-3 h-3" /> {mov.time}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
