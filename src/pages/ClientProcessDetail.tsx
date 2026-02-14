import { motion } from "framer-motion";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Clock, Info, MessageSquare, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type CaseData = {
  id: string;
  process_number: string;
  subject: string | null;
  simple_status: string | null;
  next_step: string | null;
  source: string;
};

type Movement = {
  id: string;
  title: string;
  translation: string | null;
  occurred_at: string;
  details: string | null;
};

const ClientProcessDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !user) return;

    const fetchData = async () => {
      const [caseRes, movRes] = await Promise.all([
        supabase
          .from("cases")
          .select("id, process_number, subject, simple_status, next_step, source")
          .eq("id", id)
          .eq("client_user_id", user.id)
          .single(),
        supabase
          .from("movements")
          .select("id, title, translation, occurred_at, details")
          .eq("case_id", id)
          .order("occurred_at", { ascending: false }),
      ]);

      if (caseRes.data) setCaseData(caseRes.data);
      if (movRes.data) setMovements(movRes.data);
      setLoading(false);
    };

    fetchData();
  }, [id, user]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">Processo não encontrado.</p>
        <Link to="/portal" className="text-sm text-accent hover:underline">Voltar ao portal</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="gradient-hero text-primary-foreground">
        <div className="max-w-lg mx-auto px-4 py-4">
          <Link to="/portal" className="inline-flex items-center gap-1 text-sm opacity-70 hover:opacity-100 transition-opacity mb-3">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Link>
          <h1 className="text-base font-bold">{caseData.subject || "Sem assunto"}</h1>
          <p className="text-[11px] opacity-60 font-mono mt-1">{caseData.process_number}</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-5">
        {/* Status card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl border shadow-card p-4"
        >
          <div className="bg-accent/8 rounded-lg p-4 mb-3">
            <p className="text-[10px] font-semibold text-accent uppercase tracking-wide mb-1">Status Atual</p>
            <p className="text-sm font-semibold text-foreground">{caseData.simple_status || "Cadastrado"}</p>
          </div>
          {caseData.next_step && (
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Próximo Passo</p>
              <p className="text-sm text-foreground">{caseData.next_step}</p>
            </div>
          )}
        </motion.div>

        {/* Timeline */}
        <div>
          <h2 className="text-base font-bold text-foreground mb-4">Movimentações</h2>
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
          ) : (
            <div className="space-y-0">
              {movements.map((mov, i) => (
                <motion.div
                  key={mov.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.08 }}
                  className="relative pl-7 pb-5 last:pb-0"
                >
                  {i < movements.length - 1 && <div className="absolute left-[9px] top-5 bottom-0 w-px bg-border" />}
                  <div className={cn(
                    "absolute left-0 top-0.5 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center",
                    i < 2 ? "border-accent bg-accent/15" : "border-border bg-card"
                  )}>
                    <div className={cn("w-1.5 h-1.5 rounded-full", i < 2 ? "bg-accent" : "bg-muted-foreground/40")} />
                  </div>

                  <div className="bg-card rounded-lg border p-3.5 shadow-card">
                    <div className="flex items-center justify-between mb-1.5">
                      <h3 className="text-sm font-semibold text-foreground">{mov.title}</h3>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" /> {formatDate(mov.occurred_at)}
                      </span>
                    </div>
                    {mov.translation && (
                      <div className="p-2.5 bg-accent/5 rounded-md border border-accent/10">
                        <div className="flex items-center gap-1 mb-0.5">
                          <Info className="w-3 h-3 text-accent" />
                          <span className="text-[9px] font-bold text-accent uppercase tracking-wide">O que isso significa</span>
                        </div>
                        <p className="text-xs text-foreground/80 leading-relaxed">{mov.translation}</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3 pb-6">
          <button className="flex items-center justify-center gap-2 bg-card rounded-xl border p-3 text-sm font-medium text-foreground hover:shadow-card transition-shadow">
            <MessageSquare className="w-4 h-4 text-accent" /> Chat
          </button>
          <button className="flex items-center justify-center gap-2 bg-card rounded-xl border p-3 text-sm font-medium text-foreground hover:shadow-card transition-shadow">
            <FileText className="w-4 h-4 text-accent" /> Documentos
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClientProcessDetail;
