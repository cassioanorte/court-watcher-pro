import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Scale, Bell, Clock, ArrowRight, MessageSquare, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const clientProcesses = [
  {
    id: "1",
    number: "5001234-56.2024.8.21.0001",
    subject: "Indenização por danos morais",
    simpleStatus: "Aguardando resposta da outra parte",
    nextStep: "Prazo até 28/02/2026",
    lastUpdate: "Há 2h",
    court: "TJRS",
    hasNewUpdate: true,
  },
  {
    id: "2",
    number: "5003456-78.2024.8.21.0001",
    subject: "Recurso de apelação - Família",
    simpleStatus: "Recurso em análise pelo tribunal",
    nextStep: "Aguardando pauta de julgamento",
    lastUpdate: "Há 1 dia",
    court: "TJRS",
    hasNewUpdate: false,
  },
];

const ClientPortal = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="gradient-hero text-primary-foreground">
        <div className="max-w-lg mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg gradient-accent flex items-center justify-center">
              <Scale className="w-5 h-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wide">Portal Jurídico</h1>
              <p className="text-[10px] opacity-60 uppercase tracking-widest">Escritório Silva & Associados</p>
            </div>
          </div>
          <button className="relative">
            <Bell className="w-5 h-5 opacity-80" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full" />
          </button>
        </div>
      </header>

      {/* Welcome */}
      <div className="max-w-lg mx-auto px-4 py-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-xl font-bold text-foreground">Olá, Maria 👋</h2>
          <p className="text-sm text-muted-foreground mt-1">Acompanhe seus processos em tempo real</p>
        </motion.div>

        {/* Processes */}
        <div className="mt-6 space-y-4">
          {clientProcesses.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.1 }}
            >
              <Link to={`/portal/processo/${p.id}`} className="block bg-card rounded-xl border shadow-card p-4 hover:shadow-card-hover transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{p.subject}</h3>
                      {p.hasNewUpdate && <span className="w-2 h-2 bg-accent rounded-full" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">{p.number}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground mt-0.5" />
                </div>

                <div className="space-y-2">
                  <div className="bg-accent/8 rounded-lg p-3">
                    <p className="text-[10px] font-semibold text-accent uppercase tracking-wide mb-0.5">Status Atual</p>
                    <p className="text-sm text-foreground">{p.simpleStatus}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {p.lastUpdate}</span>
                    <span className="bg-muted px-2 py-0.5 rounded-full">{p.court}</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button className="flex items-center gap-2 bg-card rounded-xl border p-4 text-sm font-medium text-foreground hover:shadow-card transition-shadow">
            <MessageSquare className="w-5 h-5 text-accent" /> Mensagens
          </button>
          <button className="flex items-center gap-2 bg-card rounded-xl border p-4 text-sm font-medium text-foreground hover:shadow-card transition-shadow">
            <FileText className="w-5 h-5 text-accent" /> Documentos
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClientPortal;
