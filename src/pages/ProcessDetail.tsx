import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, RefreshCw, MessageSquare, FileText, Plus, Info, Loader2, Save, Send, Upload, ExternalLink, Pencil, X, Trash2, Sparkles, Archive, ArchiveRestore, UserCheck, History, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import SubstabelecimentoSection from "@/components/SubstabelecimentoSection";
import CaseActivityLog from "@/components/CaseActivityLog";
import CaseAppointments from "@/components/CaseAppointments";

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
  const [activeTab, setActiveTab] = useState<"timeline" | "documentos" | "mensagens" | "atendimentos" | "substabelecimento" | "historico">("timeline");

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
  const [uploading, setUploading] = useState(false);
  const [docCategory, setDocCategory] = useState("");
  const [extractingDocId, setExtractingDocId] = useState<string | null>(null);
  const [extractingExternal, setExtractingExternal] = useState(false);
  const [extractUseAi, setExtractUseAi] = useState(false);
  const extractFileRef = useRef<HTMLInputElement>(null);
  // Edit movement
  const [editingMovId, setEditingMovId] = useState<string | null>(null);
  const [editMovTitle, setEditMovTitle] = useState("");
  const [editMovDetails, setEditMovDetails] = useState("");
  const [savingMov, setSavingMov] = useState(false);

  const isLawyer = role === "owner" || role === "staff" || role === "superadmin";

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

  const handleEditMovement = async () => {
    if (!editingMovId || !editMovTitle.trim()) return;
    setSavingMov(true);
    const { error } = await supabase
      .from("movements")
      .update({ title: editMovTitle.trim(), details: editMovDetails.trim() || null })
      .eq("id", editingMovId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setMovements((prev) =>
        prev.map((m) => m.id === editingMovId ? { ...m, title: editMovTitle.trim(), details: editMovDetails.trim() || null } : m)
      );
      setEditingMovId(null);
      toast({ title: "Movimentação atualizada!" });
    }
    setSavingMov(false);
  };

  const handleExtractClientData = async (documentId: string, useAi = false) => {
    if (!id) return;
    setExtractingDocId(documentId);
    try {
      const { data, error } = await supabase.functions.invoke("extract-client-data", {
        body: { document_id: documentId, case_id: id, use_ai: useAi },
      });
      if (error) throw error;
      if (data?.error) {
        toast({
          title: data.updated === 0 ? "Informação" : "Erro",
          description: data.error,
          variant: data.updated === 0 ? "default" : "destructive",
        });
      } else if (data?.success) {
        const fieldNames: Record<string, string> = {
          cpf: "CPF", rg: "RG", address: "Endereço", phone: "Telefone", email: "Email",
          civil_status: "Estado civil", nacionalidade: "Nacionalidade", naturalidade: "Naturalidade",
          nome_mae: "Nome da mãe", nome_pai: "Nome do pai", birth_date: "Data de nascimento",
          cnh: "CNH", ctps: "CTPS", pis: "PIS", titulo_eleitor: "Título de eleitor",
          atividade_economica: "Profissão",
        };
        const updated = Object.keys(data.fields || {}).map((k) => fieldNames[k] || k).join(", ");
        toast({ title: `${data.updated} campo(s) atualizado(s)! (${data.method === "ai" ? "IA" : "Regex"})`, description: updated });
      }
    } catch (err: any) {
      toast({ title: "Erro na extração", description: err.message, variant: "destructive" });
    } finally {
      setExtractingDocId(null);
    }
  };

  const handleExtractFromFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setExtractingExternal(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]); // Remove data:...;base64, prefix
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("extract-client-data", {
        body: { case_id: id, file_base64: base64, file_name: file.name, file_mime_type: file.type, use_ai: extractUseAi },
      });
      if (error) throw error;
      if (data?.error) {
        toast({
          title: data.updated === 0 ? "Informação" : "Erro",
          description: data.error,
          variant: data.updated === 0 ? "default" : "destructive",
        });
      } else if (data?.success) {
        const fieldNames: Record<string, string> = {
          cpf: "CPF", rg: "RG", address: "Endereço", phone: "Telefone", email: "Email",
          civil_status: "Estado civil", nacionalidade: "Nacionalidade", naturalidade: "Naturalidade",
          nome_mae: "Nome da mãe", nome_pai: "Nome do pai", birth_date: "Data de nascimento",
          cnh: "CNH", ctps: "CTPS", pis: "PIS", titulo_eleitor: "Título de eleitor",
          atividade_economica: "Profissão",
        };
        const updated = Object.keys(data.fields || {}).map((k) => fieldNames[k] || k).join(", ");
        toast({ title: `${data.updated} campo(s) atualizado(s)!`, description: updated });
      }
    } catch (err: any) {
      toast({ title: "Erro na extração", description: err.message, variant: "destructive" });
    } finally {
      setExtractingExternal(false);
      if (extractFileRef.current) extractFileRef.current.value = "";
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground">Carregando...</div>;
  if (!caseData) return <div className="text-sm text-destructive">Processo não encontrado.</div>;

  const sourceLabel: Record<string, string> = {
    TJRS_1G: "TJRS - 1º Grau", TJRS_2G: "TJRS - 2º Grau",
    TRF4_JFRS: "TRF4 - JFRS", TRF4_JFSC: "TRF4 - JFSC", TRF4_JFPR: "TRF4 - JFPR",
    TRF4: "TRF4",
  };

  // Format process number to CNJ pattern: NNNNNNN-DD.AAAA.J.TR.OOOO
  const formatCNJ = (n: string): string => {
    const digits = n.replace(/\D/g, "");
    if (digits.length === 20) {
      return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
    }
    return n;
  };

  const tribunalUrls: Record<string, (n: string) => string> = {
    TRF4_JFRS: (n) => `https://consulta.trf4.jus.br/trf4/controlador.php?acao=consulta_processual_resultado_pesquisa&selForma=NU&txtValor=${encodeURIComponent(formatCNJ(n))}&selOrigem=RS&chkMostrarBaixados=S`,
    TRF4_JFSC: (n) => `https://consulta.trf4.jus.br/trf4/controlador.php?acao=consulta_processual_resultado_pesquisa&selForma=NU&txtValor=${encodeURIComponent(formatCNJ(n))}&selOrigem=SC&chkMostrarBaixados=S`,
    TRF4_JFPR: (n) => `https://consulta.trf4.jus.br/trf4/controlador.php?acao=consulta_processual_resultado_pesquisa&selForma=NU&txtValor=${encodeURIComponent(formatCNJ(n))}&selOrigem=PR&chkMostrarBaixados=S`,
    TRF4: (n) => `https://consulta.trf4.jus.br/trf4/controlador.php?acao=consulta_processual_resultado_pesquisa&selForma=NU&txtValor=${encodeURIComponent(formatCNJ(n))}&selOrigem=TRF&chkMostrarBaixados=S`,
    TJRS_1G: (n) => `https://comunica.pje.jus.br/consulta/processo/unificada/${encodeURIComponent(formatCNJ(n))}`,
    TJRS_2G: (n) => `https://comunica.pje.jus.br/consulta/processo/unificada/${encodeURIComponent(formatCNJ(n))}`,
  };

  const tribunalUrl = tribunalUrls[caseData.source]?.(caseData.process_number);

  const tabs = [
    { key: "timeline" as const, label: "Timeline", icon: RefreshCw },
    { key: "documentos" as const, label: "Documentos", icon: FileText },
    { key: "mensagens" as const, label: "Mensagens", icon: MessageSquare },
    ...(isLawyer ? [
      { key: "substabelecimento" as const, label: "Substabelecimento", icon: UserCheck },
      { key: "historico" as const, label: "Histórico", icon: History },
    ] : []),
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
            {caseData.archived && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                <Archive className="w-3 h-3" /> Arquivado
              </span>
            )}
            {caseData.automation_enabled && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success/15 px-2.5 py-1 rounded-full">
                <RefreshCw className="w-3 h-3" /> Automação ativa
              </span>
            )}
            <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
              {sourceLabel[caseData.source] || caseData.source}
            </span>
            {isLawyer && (
              <button
                onClick={async () => {
                  const newArchived = !caseData.archived;
                  const { error } = await supabase.from("cases").update({ archived: newArchived } as any).eq("id", id);
                  if (error) {
                    toast({ title: "Erro", description: error.message, variant: "destructive" });
                  } else {
                    setCaseData((prev: any) => ({ ...prev, archived: newArchived }));
                    toast({ title: newArchived ? "Processo arquivado!" : "Processo desarquivado!" });
                  }
                }}
                className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border hover:bg-muted transition-colors text-muted-foreground"
              >
                {caseData.archived ? <ArchiveRestore className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
                {caseData.archived ? "Desarquivar" : "Arquivar"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-card rounded-lg p-4 border shadow-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Status</p>
          <p className="text-sm font-semibold text-foreground">{caseData.simple_status || "—"}</p>
        </div>
        <div className="bg-card rounded-lg p-4 border shadow-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Partes Envolvidas</p>
          {(() => {
            const parts = (caseData.parties || "").split(/\s*\|\s*/);
            const author = parts[0]?.trim();
            const defendant = parts[1]?.trim();
            return (
              <div className="space-y-0.5">
                {author ? <p className="text-xs text-foreground"><span className="text-muted-foreground">Autor:</span> {author}</p> : null}
                {defendant ? <p className="text-xs text-foreground"><span className="text-muted-foreground">Réu:</span> {defendant}</p> : null}
                {!author && !defendant && <p className="text-sm text-foreground">—</p>}
              </div>
            );
          })()}
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
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg gradient-accent text-accent-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {refreshing ? "Consultando tribunais..." : "Atualizar movimentações"}
        </button>
        {tribunalUrl && (
          <a
            href={tribunalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="w-4 h-4" /> Abrir no tribunal
          </a>
        )}
      </div>

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
                {editingMovId === mov.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editMovTitle}
                      onChange={(e) => setEditMovTitle(e.target.value)}
                      className="w-full h-9 px-3 rounded-md bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
                      placeholder="Título"
                    />
                    <textarea
                      value={editMovDetails}
                      onChange={(e) => setEditMovDetails(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 rounded-md bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none"
                      placeholder="Detalhes (opcional)"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleEditMovement}
                        disabled={savingMov || !editMovTitle.trim()}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md gradient-accent text-accent-foreground text-xs font-semibold disabled:opacity-50"
                      >
                        {savingMov ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Salvar
                      </button>
                      <button
                        onClick={() => setEditingMovId(null)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border text-xs text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-3 h-3" /> Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-sm font-semibold text-foreground">{mov.title}</h3>
                      <div className="flex items-center gap-2 shrink-0">
                        {isLawyer && (
                          <button
                            onClick={() => { setEditingMovId(mov.id); setEditMovTitle(mov.title); setEditMovDetails(mov.details || ""); }}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title="Editar movimentação"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <span className="text-[10px] text-muted-foreground">{new Date(mov.occurred_at).toLocaleString("pt-BR")}</span>
                      </div>
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
                  </>
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
          {/* Extract from external file button */}
          {isLawyer && caseData.client_user_id && (
            <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-foreground">Extrair dados do cliente</p>
                <p className="text-[11px] text-muted-foreground">Faça upload de um documento (petição, procuração, etc.) para preencher automaticamente o cadastro</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={extractUseAi} onChange={(e) => setExtractUseAi(e.target.checked)} className="rounded border-muted" />
                  Usar IA (consome créditos, funciona com imagens)
                </label>
              </div>
              <input
                ref={extractFileRef}
                type="file"
                className="hidden"
                accept={extractUseAi ? ".pdf,.jpg,.jpeg,.png,.webp" : ".pdf"}
                onChange={handleExtractFromFile}
              />
              <button
                onClick={() => extractFileRef.current?.click()}
                disabled={extractingExternal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg gradient-accent text-accent-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {extractingExternal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {extractingExternal ? "Extraindo..." : extractUseAi ? "Upload e extrair (IA)" : "Upload e extrair (Regex)"}
              </button>
            </div>
          )}
          {documents.length === 0 && !isLawyer && (
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
              <div className="flex items-center gap-2">
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">Abrir</a>
                {isLawyer && caseData.client_user_id && (
                  <>
                    <button
                      onClick={() => handleExtractClientData(doc.id, false)}
                      disabled={extractingDocId === doc.id}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
                      title="Extrair dados via regex (grátis, só PDF com texto)"
                    >
                      {extractingDocId === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      Extrair
                    </button>
                    <button
                      onClick={() => handleExtractClientData(doc.id, true)}
                      disabled={extractingDocId === doc.id}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                      title="Extrair dados com IA (consome créditos, funciona com imagens)"
                    >
                      {extractingDocId === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      IA
                    </button>
                  </>
                )}
                {isLawyer && (
                  <button
                    onClick={async () => {
                      if (!confirm("Excluir este documento?")) return;
                      const { error } = await supabase.from("documents").delete().eq("id", doc.id);
                      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
                      else setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
                    }}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    title="Excluir documento"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {isLawyer && (
            <div className="border-2 border-dashed rounded-lg p-6 text-center space-y-3">
              <Upload className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">Arraste ou selecione arquivos para anexar</p>
              <div className="flex items-center justify-center gap-2">
                <select value={docCategory} onChange={(e) => setDocCategory(e.target.value)} className="h-9 px-3 rounded-lg bg-background border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40">
                  <option value="">Sem categoria</option>
                  <option value="Petição">Petição</option>
                  <option value="Procuração">Procuração</option>
                  <option value="Contrato">Contrato</option>
                  <option value="Comprovante">Comprovante</option>
                  <option value="Decisão">Decisão</option>
                  <option value="Laudo">Laudo</option>
                  <option value="Outro">Outro</option>
                </select>
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg gradient-accent text-accent-foreground text-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? "Enviando..." : "Selecionar arquivo"}
                  <input
                    type="file"
                    className="hidden"
                    disabled={uploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !id || !user) return;
                      setUploading(true);
                      try {
                        const ext = file.name.split(".").pop();
                        const path = `${id}/${Date.now()}.${ext}`;
                        const { error: uploadError } = await supabase.storage.from("case-documents").upload(path, file);
                        if (uploadError) throw uploadError;
                        const { data: urlData } = supabase.storage.from("case-documents").getPublicUrl(path);
                        const { data: docData, error: insertError } = await supabase.from("documents").insert({
                          case_id: id,
                          name: file.name,
                          file_url: urlData.publicUrl,
                          category: docCategory || null,
                          uploaded_by: user.id,
                        }).select("*").single();
                        if (insertError) throw insertError;
                        if (docData) setDocuments((prev) => [docData, ...prev]);
                        toast({ title: "Documento anexado!" });
                      } catch (err: any) {
                        toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
                      } finally {
                        setUploading(false);
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          )}
          {documents.length === 0 && isLawyer && (
            <p className="text-xs text-muted-foreground text-center">Nenhum documento anexado ainda.</p>
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
      {activeTab === "substabelecimento" && isLawyer && (
        <SubstabelecimentoSection
          caseId={id!}
          responsibleUserId={caseData.responsible_user_id}
          onResponsibleChanged={(newId) => setCaseData((prev: any) => ({ ...prev, responsible_user_id: newId }))}
        />
      )}

      {activeTab === "historico" && isLawyer && (
        <CaseActivityLog caseId={id!} />
      )}
    </div>
  );
};

export default ProcessDetail;
