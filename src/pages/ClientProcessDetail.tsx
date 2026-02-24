import { motion } from "framer-motion";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Clock, Info, MessageSquare, FileText, Send, Download, Upload, Loader2, ExternalLink, Sparkles } from "lucide-react";
import { FileDropZone } from "@/components/ui/file-drop-zone";
import { cn } from "@/lib/utils";
import { getCourtUrl, getAuthenticatedCourtUrl, openViaBlank } from "@/lib/courtUrls";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

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

type Message = {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  is_internal: boolean | null;
};

type Document = {
  id: string;
  name: string;
  file_url: string;
  category: string | null;
  created_at: string;
};

type Tab = "timeline" | "messages" | "documents";

const ClientProcessDetail = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const initialTab = (searchParams.get("tab") as Tab) || "timeline";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const extractFileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [extractingDocId, setExtractingDocId] = useState<string | null>(null);
  const [extractingExternal, setExtractingExternal] = useState(false);

  useEffect(() => {
    if (!id || !user) return;

    const fetchData = async () => {
      const [caseRes, movRes, msgRes, docRes] = await Promise.all([
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
        supabase
          .from("messages")
          .select("id, content, sender_id, created_at, is_internal")
          .eq("case_id", id)
          .order("created_at", { ascending: true }),
        supabase
          .from("documents")
          .select("id, name, file_url, category, created_at")
          .eq("case_id", id)
          .order("created_at", { ascending: false }),
      ]);

      if (caseRes.data) setCaseData(caseRes.data);
      if (movRes.data) setMovements(movRes.data);
      if (msgRes.data) setMessages(msgRes.data);
      if (docRes.data) setDocuments(docRes.data);
      setLoading(false);
    };

    fetchData();
  }, [id, user]);

  useEffect(() => {
    if (activeTab === "messages") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeTab]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !id || !user || sending) return;
    setSending(true);
    const { data, error } = await supabase
      .from("messages")
      .insert({ case_id: id, sender_id: user.id, content: newMessage.trim(), is_internal: false })
      .select()
      .single();

    if (data) {
      setMessages((prev) => [...prev, data]);
      setNewMessage("");
    }
    setSending(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id || !user) return;
    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${id}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("case-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("case-documents")
        .getPublicUrl(filePath);

      const { data: docData, error: insertError } = await supabase
        .from("documents")
        .insert({
          case_id: id,
          uploaded_by: user.id,
          name: file.name,
          file_url: urlData.publicUrl,
          category: "Enviado pelo cliente",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (docData) {
        setDocuments((prev) => [docData, ...prev]);
        toast({ title: "Documento enviado com sucesso!" });
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleExtractClientData = async (documentId: string) => {
    if (!id) return;
    setExtractingDocId(documentId);
    try {
      const { data, error } = await supabase.functions.invoke("extract-client-data", {
        body: { document_id: documentId, case_id: id },
      });
      if (error) throw error;
      const fieldNames: Record<string, string> = {
        cpf: "CPF", rg: "RG", address: "Endereço", phone: "Telefone", email: "Email",
        civil_status: "Estado civil", nacionalidade: "Nacionalidade", naturalidade: "Naturalidade",
        nome_mae: "Nome da mãe", nome_pai: "Nome do pai", birth_date: "Data de nascimento",
        cnh: "CNH", ctps: "CTPS", pis: "PIS", titulo_eleitor: "Título de eleitor",
        atividade_economica: "Profissão",
      };
      if (data?.error) {
        toast({
          title: data.updated === 0 ? "Informação" : "Erro",
          description: data.error,
          variant: data.updated === 0 ? "default" : "destructive",
        });
      } else if (data?.success) {
        const updated = Object.keys(data.fields || {}).map((k) => fieldNames[k] || k).join(", ");
        toast({ title: `${data.updated} campo(s) atualizado(s)!`, description: updated });
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
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("extract-client-data", {
        body: { case_id: id, file_base64: base64, file_name: file.name, file_mime_type: file.type },
      });
      if (error) throw error;
      const fieldNames: Record<string, string> = {
        cpf: "CPF", rg: "RG", address: "Endereço", phone: "Telefone", email: "Email",
        civil_status: "Estado civil", nacionalidade: "Nacionalidade", naturalidade: "Naturalidade",
        nome_mae: "Nome da mãe", nome_pai: "Nome do pai", birth_date: "Data de nascimento",
        cnh: "CNH", ctps: "CTPS", pis: "PIS", titulo_eleitor: "Título de eleitor",
        atividade_economica: "Profissão",
      };
      if (data?.error) {
        toast({
          title: data.updated === 0 ? "Informação" : "Erro",
          description: data.error,
          variant: data.updated === 0 ? "default" : "destructive",
        });
      } else if (data?.success) {
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

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("pt-BR");
  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

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

  const formatCNJ = (n: string): string => {
    const digits = n.replace(/\D/g, "");
    if (digits.length === 20) {
      return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
    }
    return n;
  };

  const isEprocSource = caseData.source === "TJRS_1G" || caseData.source === "TJRS_2G" || caseData.source === "TRF4_JFRS" || caseData.source === "TRF4_JFSC" || caseData.source === "TRF4_JFPR" || caseData.source === "TRF4";
  const tribunalUrl = isEprocSource
    ? getAuthenticatedCourtUrl(caseData.process_number, caseData.source) ?? getCourtUrl(caseData.process_number, caseData.source)
    : getCourtUrl(caseData.process_number, caseData.source);

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: "timeline", label: "Timeline", icon: <Clock className="w-4 h-4" /> },
    { key: "messages", label: "Chat", icon: <MessageSquare className="w-4 h-4" />, count: messages.length },
    { key: "documents", label: "Docs", icon: <FileText className="w-4 h-4" />, count: documents.length },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="gradient-hero text-primary-foreground shrink-0">
        <div className="max-w-lg mx-auto px-4 py-4">
          <Link to="/portal" className="inline-flex items-center gap-1 text-sm opacity-70 hover:opacity-100 transition-opacity mb-3">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Link>
          <h1 className="text-base font-bold">{caseData.subject || "Sem assunto"}</h1>
          <p className="text-[11px] opacity-60 font-mono mt-1">{caseData.process_number}</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto w-full px-4 py-4 flex-1 flex flex-col">
        {/* Status card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl border shadow-card p-4 mb-4 shrink-0"
        >
          <div className="bg-accent/8 rounded-lg p-3">
            <p className="text-[10px] font-semibold text-accent uppercase tracking-wide mb-0.5">Status Atual</p>
            <p className="text-sm font-semibold text-foreground">{caseData.simple_status || "Cadastrado"}</p>
          </div>
          {caseData.next_step && (
            <div className="bg-muted/50 rounded-lg p-3 mt-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Próximo Passo</p>
              <p className="text-sm text-foreground">{caseData.next_step}</p>
            </div>
          )}
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/50 rounded-lg p-1 mb-4 shrink-0">
          {tribunalUrl && (
            <button
              onClick={() => {
                const num = isEprocSource ? caseData.process_number.replace(/\D/g, "") : undefined;
                openViaBlank(tribunalUrl, num);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium text-accent hover:bg-card hover:shadow-sm transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              Tribunal
            </button>
          )}
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all",
                activeTab === tab.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="bg-accent/15 text-accent text-[10px] px-1.5 py-0.5 rounded-full font-bold">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 flex flex-col min-h-0">
          {activeTab === "timeline" && (
            <div className="pb-6">
              {movements.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma movimentação registrada.</p>
              ) : (
                <div className="space-y-0">
                  {movements.map((mov, i) => (
                    <motion.div
                      key={mov.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
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
          )}

          {activeTab === "messages" && (
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto space-y-3 pb-3">
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma mensagem ainda. Envie a primeira!</p>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.sender_id === user?.id;
                    return (
                      <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[80%] rounded-xl px-3.5 py-2.5",
                          isMe
                            ? "bg-accent text-accent-foreground rounded-br-sm"
                            : "bg-card border rounded-bl-sm"
                        )}>
                          <p className="text-sm">{msg.content}</p>
                          <p className={cn("text-[10px] mt-1", isMe ? "text-accent-foreground/60" : "text-muted-foreground")}>
                            {formatTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="flex gap-2 pt-3 border-t shrink-0 pb-4">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Escreva sua mensagem..."
                  className="flex-1 h-10 px-3 rounded-lg bg-card border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="h-10 w-10 rounded-lg gradient-accent flex items-center justify-center text-accent-foreground disabled:opacity-50 transition-opacity"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {activeTab === "documents" && (
            <div className="pb-6 space-y-3">
              {/* Extract from external file */}
              <div className="bg-accent/5 border border-accent/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-accent" />
                  <p className="text-sm font-medium text-foreground">Extrair dados de documento</p>
                </div>
                <p className="text-[11px] text-muted-foreground mb-3">Envie um documento (petição, certidão, etc.) para preencher seu cadastro automaticamente</p>
                <input
                  ref={extractFileRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={handleExtractFromFile}
                />
                <FileDropZone
                  onFile={(f) => {
                    const dt = new DataTransfer();
                    dt.items.add(f);
                    if (extractFileRef.current) {
                      extractFileRef.current.files = dt.files;
                      extractFileRef.current.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                  }}
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  loading={extractingExternal}
                  loadingText="Extraindo dados..."
                  label="Arraste o arquivo aqui ou clique para extrair dados"
                  compact
                />
              </div>

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.xls,.xlsx,.txt"
              />
              <FileDropZone
                onFile={(f) => {
                  const dt = new DataTransfer();
                  dt.items.add(f);
                  if (fileInputRef.current) {
                    fileInputRef.current.files = dt.files;
                    fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
                  }
                }}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.xls,.xlsx,.txt"
                loading={uploading}
                loadingText="Enviando..."
                label="Arraste ou clique para enviar documento"
              />

              {documents.length === 0 && !uploading ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum documento disponível.</p>
              ) : (
                documents.map((doc, i) => (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="bg-card rounded-lg border p-3.5 shadow-card"
                  >
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                    >
                      <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {doc.category || "Documento"} · {formatDate(doc.created_at)}
                        </p>
                      </div>
                      <Download className="w-4 h-4 text-muted-foreground shrink-0" />
                    </a>
                    <button
                      onClick={() => handleExtractClientData(doc.id)}
                      disabled={extractingDocId === doc.id}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
                    >
                      {extractingDocId === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      {extractingDocId === doc.id ? "Extraindo..." : "Extrair dados deste documento"}
                    </button>
                  </motion.div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientProcessDetail;
