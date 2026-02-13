import { motion } from "framer-motion";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, RefreshCw, MessageSquare, FileText, Plus, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const movements = [
  { date: "13/02/2026 10:30", title: "Decisão interlocutória publicada", detail: "Juiz deferiu pedido de tutela antecipada.", translation: "O juiz aceitou seu pedido urgente. A decisão já está valendo.", source: "eproc TJRS", isNew: true },
  { date: "10/02/2026 14:15", title: "Juntada de petição", detail: "Petição inicial juntada aos autos.", translation: "O documento que abre o processo foi anexado oficialmente.", source: "eproc TJRS", isNew: true },
  { date: "08/02/2026 09:00", title: "Distribuição", detail: "Processo distribuído à 5ª Vara Cível de Porto Alegre.", translation: "Seu processo foi encaminhado para o juiz responsável na 5ª Vara Cível.", source: "eproc TJRS", isNew: false },
  { date: "07/02/2026 16:45", title: "Registro do processo", detail: "Novo processo registrado no sistema eproc.", translation: "O processo foi criado no sistema do tribunal.", source: "eproc TJRS", isNew: false },
];

const ProcessDetail = () => {
  const { id } = useParams();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back + header */}
      <div>
        <Link to="/processos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">5001234-56.2024.8.21.0001</h1>
            <p className="text-sm text-muted-foreground mt-1">Indenização por danos morais • Maria Silva</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success/15 px-2.5 py-1 rounded-full">
              <RefreshCw className="w-3 h-3" /> Automação ativa
            </span>
            <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full">TJRS - 1º Grau</span>
          </div>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-lg p-4 border shadow-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Status Simplificado</p>
          <p className="text-sm font-semibold text-foreground">Aguardando manifestação da parte contrária</p>
        </div>
        <div className="bg-card rounded-lg p-4 border shadow-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Próximo Passo</p>
          <p className="text-sm font-semibold text-foreground">Prazo para contestação até 28/02/2026</p>
        </div>
        <div className="bg-card rounded-lg p-4 border shadow-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Responsável</p>
          <p className="text-sm font-semibold text-foreground">Dr. André Junior</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {[
          { label: "Timeline", icon: RefreshCw, active: true },
          { label: "Documentos", icon: FileText, active: false },
          { label: "Mensagens", icon: MessageSquare, active: false },
        ].map((tab) => (
          <button
            key={tab.label}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
              tab.active
                ? "border-accent text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="space-y-0">
        {movements.map((mov, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="relative pl-8 pb-6 last:pb-0"
          >
            {/* Line */}
            {i < movements.length - 1 && (
              <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />
            )}
            {/* Dot */}
            <div className={cn(
              "absolute left-0 top-1 w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center",
              mov.isNew
                ? "border-accent bg-accent/15"
                : "border-border bg-card"
            )}>
              <div className={cn("w-2 h-2 rounded-full", mov.isNew ? "bg-accent" : "bg-muted-foreground/40")} />
            </div>

            <div className="bg-card rounded-lg border p-4 shadow-card">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold text-foreground">{mov.title}</h3>
                <span className="text-[10px] text-muted-foreground shrink-0">{mov.date}</span>
              </div>
              <p className="text-xs text-muted-foreground">{mov.detail}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Fonte: {mov.source}</p>

              {/* Translation */}
              <div className="mt-3 p-3 bg-accent/5 rounded-md border border-accent/15">
                <div className="flex items-center gap-1 mb-1">
                  <Info className="w-3 h-3 text-accent" />
                  <span className="text-[10px] font-semibold text-accent uppercase tracking-wide">Entenda a movimentação</span>
                </div>
                <p className="text-xs text-foreground/80">{mov.translation}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Manual add */}
      <button className="w-full border-2 border-dashed rounded-lg p-4 text-sm text-muted-foreground hover:text-foreground hover:border-accent/40 transition-colors flex items-center justify-center gap-2">
        <Plus className="w-4 h-4" /> Adicionar movimentação manual
      </button>
    </div>
  );
};

export default ProcessDetail;
