import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, RefreshCw, MessageSquare, FileText, Plus, Info, Loader2, Save, Send, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const ProcessDetail = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const { tenantId, role, user } = useAuth();
  const [caseData, setCaseData] = useState<any>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"timeline" | "documentos" | "mensagens">("timeline");

  // Editable fields
  const [editingSummary, setEditingSummary] = useState(false);
  const [editingNextStep, setEditingNextStep] = useState(false);
  const [caseSummary, setCaseSummary] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [savingSummary, setSavingSummary] = useState(false);
  const [savingNextStep, setSavingNextStep] = useState(false);

  // New message
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  // Manual movement
  const [showAddMovement, setShowAddMovement] = useState(false);
  const [manualMovTitle, setManualMovTitle] = useState("");
  const [manualMovDetails, setManualMovDetails] = useState("");
  const [addingMovement, setAddingMovement] = useState(false);

  const isLawyer = role === "owner" || role === "staff";

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const [caseRes, movRes, msgRes, docRes] = await Promise.all([
        supabase.from("cases").select("*").eq("id", id).single(),
        supabase.from("movements").select("*").eq("case_id", id).order("occurred_at", { ascending: false }),
        supabase.from("messages").select("*").eq("case_id", id).order("created_at", { ascending: true }),
        supabase.from("documents").select("*").eq("case_id", id).order("created_at", { ascending: false }),
      ]);
      if (caseRes.data) {
        setCaseData(caseRes.data);
        setCaseSummary(caseRes.data.case_summary || "");
        setNextStep(caseRes.data.next_step || "");
      }
      if (movRes.data) setMovements(movRes.data);
      if (msgRes.data) setMessages(msgRes.data);
      if (docRes.data) setDocuments(docRes.data);
      setLoading(false);
    };
    load();
  }, [id]);

  const handleRefresh = async () => {
    if (!id) return;
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-movements", {
        body: { case_id: id },
      });
      if (error) throw error;
      toast({
        title: "Consulta realizada!",
        description: `${data.new_movements || 0} nova(s) movimentação(ões) encontrada(s).`,
      });
      const { data: movData } = await supabase.from("movements").select("*").eq("case_id", id).order("occurred_at", { ascending: false });
      if (movData) setMovements(movData);
      const { data: cData } = await supabase.from("cases").select("*").eq("id", id).single();
      if (cData) setCaseData(cData);
    } catch (err: any) {
      toast({ title: "Erro na consulta", description: err.message, variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  };

  const handleSaveSummary = async () => {
    if (!id) return;
    setSavingSummary(true);
    const { error } = await supabase.from("cases").update({ case_summary: caseSummary }).eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      setCaseData((prev: any) => ({ ...prev, case_summary: caseSummary }));
      setEditingSummary(false);
      toast({ title: "Resumo salvo!" });
    }
    setSavingSummary(false);
  };

  const handleSaveNextStep = async () => {
    if (!id) return;
    setSavingNextStep(true);
    const { error } = await supabase.from("cases").update({ next_step: nextStep }).eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      setCaseData((prev: any) => ({ ...prev, next_step: nextStep }));
      setEditingNextStep(false);
      toast({ title: "Próximo passo salvo!" });
    }
    setSavingNextStep(false);
  };

  const handleSendMessage = async () => {
    if (!id || !newMessage.trim() || !user) return;
    setSendingMessage(true);
    const { data, error } = await supabase.from("messages").insert({
      case_id: id,
      sender_id: user.id,
      content: newMessage.trim(),
      is_internal: false,
    }).select("*").single();
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else if (data) {
      setMessages((prev) => [...prev, data]);
      setNewMessage("");
    }
    setSendingMessage(false);
  };

  const handleAddMovement = async () => {
    if (!id || !manualMovTitle.trim() || !user) return;
    setAddingMovement(true);
    const now = new Date().toISOString();
    const hash = `manual_${id}_${Date.now()}`;
    const { data, error } = await supabase.from("movements").insert({
      case_id: id,
      title: manualMovTitle.trim(),
      details: manualMovDetails.trim() || null,
      occurred_at: now,
      source_label: "Manual",
      is_manual: true,
      unique_hash: hash,
    }).select("*").single();
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else if (data) {
      setMovements((prev) => [data, ...prev]);
      setManualMovTitle("");
      setManualMovDetails("");
      setShowAddMovement(false);
      toast({ title: "Movimentação adicionada!" });
    }
    setAddingMovement(false);
  };

  if (loading) return <div className="text-sm text-muted-foreground">Carregando...</div>;
  if (!caseData) return <div className="text-sm text-destructive">Processo não encontrado.</div>;

  const sourceLabel: Record<string, string> = {
    TJRS_1G: "TJRS - 1º Grau", TJRS_2G: "TJRS - 2º Grau",
    TRF4_JFRS: "TRF4 - JFRS", TRF4_JFSC: "TRF4 - JFSC", TRF4_JFPR: "TRF4 - JFPR",
  };

  const tabs = [
    { key: "timeline" as const, label: "Timeline", icon: RefreshCw },
    { key: "documentos" as const, label: "Documentos", icon: FileText },
    { key: "mensagens" as const, label: "Mensagens", icon: MessageSquare },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back + header */}
      <div>
        <Link to="/processos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">{caseData.process_number}</h1>
            <p className="text-sm text-muted-foreground mt-1">{caseData.subject || "Sem assunto"}</p>
          </div>
          <div className="flex items-center gap-2">
            {caseData.automation_enabled && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success/15 px-2.5 py-1 rounded-full">
                <RefreshCw className="w-3 h-3" /> Automação ativa
              </span>
            )}
            <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
              {sourceLabel[caseData.source] || caseData.source}
            </span>
          </div>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg p-4 border shadow-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Status</p>
          <p className="text-sm font-semibold text-foreground">{caseData.simple_status || "—"}</p>
        </div>
        <div className="bg-card rounded-lg p-4 border shadow-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Última consulta</p>
          <p className="text-sm font-semibold text-foreground">
            {caseData.last_checked_at ? new Date(caseData.last_checked_at).toLocaleString("pt-BR") : "Nunca consultado"}
          </p>
        </div>

        {/* Resumo do caso */}
        <div className="bg-card rounded-lg p-4 border shadow-card col-span-1 md:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Resumo do caso</p>
            {isLawyer && !editingSummary && (
              <button onClick={() => setEditingSummary(true)} className="text-[10px] text-accent hover:underline">Editar</button>
            )}
          </div>
          {editingSummary && isLawyer ? (
            <div className="space-y-2">
              <textarea value={caseSummary} onChange={(e) => setCaseSummary(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none" placeholder="Descreva o resumo do caso..." />
              <div className="flex gap-2">
                <button onClick={handleSaveSummary} disabled={savingSummary} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg gradient-accent text-accent-foreground text-xs font-semibold disabled:opacity-50">
                  {savingSummary ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Salvar
                </button>
                <button onClick={() => { setEditingSummary(false); setCaseSummary(caseData.case_summary || ""); }} className="px-3 py-1.5 rounded-lg border text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-foreground">{caseData.case_summary || "—"}</p>
          )}
        </div>

        {/* Próximo passo */}
        <div className="bg-card rounded-lg p-4 border shadow-card">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Próximo Passo</p>
            {isLawyer && !editingNextStep && (
              <button onClick={() => setEditingNextStep(true)} className="text-[10px] text-accent hover:underline">Editar</button>
            )}
          </div>
          {editingNextStep && isLawyer ? (
            <div className="space-y-2">
              <textarea value={nextStep} onChange={(e) => setNextStep(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none" placeholder="Qual o próximo passo?" />
              <div className="flex gap-2">
                <button onClick={handleSaveNextStep} disabled={savingNextStep} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg gradient-accent text-accent-foreground text-xs font-semibold disabled:opacity-50">
                  {savingNextStep ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Salvar
                </button>
                <button onClick={() => { setEditingNextStep(false); setNextStep(caseData.next_step || ""); }} className="px-3 py-1.5 rounded-lg border text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-foreground">{caseData.next_step || "—"}</p>
          )}
        </div>
      </div>

      {/* Atualizar button */}
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg gradient-accent text-accent-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        {refreshing ? "Consultando tribunais..." : "Atualizar movimentações"}
      </button>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
              activeTab === tab.key
                ? "border-accent text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "timeline" && (
        <div className="space-y-0">
          {movements.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhuma movimentação registrada. Clique em "Atualizar movimentações" para consultar os tribunais.
            </p>
          )}
          {movements.map((mov, i) => (
            <motion.div key={mov.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="relative pl-8 pb-6 last:pb-0">
              {i < movements.length - 1 && <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />}
              <div className={cn("absolute left-0 top-1 w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center", i < 2 ? "border-accent bg-accent/15" : "border-border bg-card")}>
                <div className={cn("w-2 h-2 rounded-full", i < 2 ? "bg-accent" : "bg-muted-foreground/40")} />
              </div>
              <div className="bg-card rounded-lg border p-4 shadow-card">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-foreground">{mov.title}</h3>
                  <span className="text-[10px] text-muted-foreground shrink-0">{new Date(mov.occurred_at).toLocaleString("pt-BR")}</span>
                </div>
                {mov.details && <p className="text-xs text-muted-foreground">{mov.details}</p>}
                {mov.source_label && <p className="text-[10px] text-muted-foreground mt-1">Fonte: {mov.source_label}</p>}
                {mov.translation && (
                  <div className="mt-3 p-3 bg-accent/5 rounded-md border border-accent/15">
                    <div className="flex items-center gap-1 mb-1">
                      <Info className="w-3 h-3 text-accent" />
                      <span className="text-[10px] font-semibold text-accent uppercase tracking-wide">Entenda a movimentação</span>
                    </div>
                    <p className="text-xs text-foreground/80">{mov.translation}</p>
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {/* Manual add */}
          {isLawyer && (
            showAddMovement ? (
              <div className="border-2 border-dashed rounded-lg p-4 space-y-3">
                <input type="text" value={manualMovTitle} onChange={(e) => setManualMovTitle(e.target.value)} placeholder="Título da movimentação *" className="w-full h-10 px-3 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" />
                <textarea value={manualMovDetails} onChange={(e) => setManualMovDetails(e.target.value)} placeholder="Detalhes (opcional)" rows={2} className="w-full px-3 py-2 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none" />
                <div className="flex gap-2">
                  <button onClick={handleAddMovement} disabled={addingMovement || !manualMovTitle.trim()} className="inline-flex items-center gap-1 px-4 py-2 rounded-lg gradient-accent text-accent-foreground text-sm font-semibold disabled:opacity-50">
                    {addingMovement ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Adicionar
                  </button>
                  <button onClick={() => setShowAddMovement(false)} className="px-4 py-2 rounded-lg border text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAddMovement(true)} className="w-full border-2 border-dashed rounded-lg p-4 text-sm text-muted-foreground hover:text-foreground hover:border-accent/40 transition-colors flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Adicionar movimentação manual
              </button>
            )
          )}
        </div>
      )}

      {activeTab === "documentos" && (
        <div className="space-y-4">
          {documents.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhum documento anexado a este processo.</p>
          )}
          {documents.map((doc) => (
            <div key={doc.id} className="bg-card rounded-lg border p-4 shadow-card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">{doc.name}</p>
                  <p className="text-[10px] text-muted-foreground">{doc.category || "Sem categoria"} · {new Date(doc.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
              </div>
              <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">Abrir</a>
            </div>
          ))}
          {isLawyer && (
            <p className="text-xs text-muted-foreground text-center">Upload de documentos será disponibilizado em breve.</p>
          )}
        </div>
      )}

      {activeTab === "mensagens" && (
        <div className="space-y-4">
          <div className="bg-card rounded-lg border shadow-card overflow-hidden">
            <div className="max-h-80 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma mensagem. Inicie a conversa abaixo.</p>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={cn("flex", msg.sender_id === user?.id ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[75%] rounded-lg px-3 py-2 text-sm", msg.sender_id === user?.id ? "bg-accent text-accent-foreground" : "bg-muted text-foreground")}>
                    <p>{msg.content}</p>
                    <p className="text-[10px] opacity-70 mt-1">{new Date(msg.created_at).toLocaleString("pt-BR")}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t p-3 flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                placeholder="Digite sua mensagem..."
                className="flex-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              <button onClick={handleSendMessage} disabled={sendingMessage || !newMessage.trim()} className="inline-flex items-center gap-1 px-4 py-2 rounded-lg gradient-accent text-accent-foreground text-sm font-semibold disabled:opacity-50">
                {sendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessDetail;
