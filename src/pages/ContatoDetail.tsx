import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Pencil, Trash2, Save, X, Camera, Upload, FileText, Link2, Download, Loader2, ExternalLink, FolderOpen, Sparkles, MousePointerClick, ClipboardPaste, CheckCircle2, Copy } from "lucide-react";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ContatoDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { tenantId, user } = useAuth();
  const { toast } = useToast();
  const [contact, setContact] = useState<any>(null);
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  // Documents state
  const [clientDocs, setClientDocs] = useState<any[]>([]);
  const [officeDocs, setOfficeDocs] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [addingLink, setAddingLink] = useState(false);
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [extractingDocId, setExtractingDocId] = useState<string | null>(null);
  const [extractingExternal, setExtractingExternal] = useState(false);
  const extractFileRef = useRef<HTMLInputElement>(null);
  const [showTextExtract, setShowTextExtract] = useState(false);
  const [extractText, setExtractText] = useState("");
  const [extractingText, setExtractingText] = useState(false);
  const [extractPreview, setExtractPreview] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const [profileRes, casesRes, clientDocsRes, officeDocsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", id).single(),
        supabase.from("cases").select("*").eq("client_user_id", id).order("updated_at", { ascending: false }),
        // Client-uploaded docs across all their cases
        supabase.from("documents").select("*").eq("uploaded_by", id).eq("category", "Enviado pelo cliente").order("created_at", { ascending: false }),
        // Office docs for this contact
        supabase.from("contact_documents").select("*").eq("contact_user_id", id).order("created_at", { ascending: false }),
      ]);
      setContact(profileRes.data);
      setCases(casesRes.data || []);
      setClientDocs(clientDocsRes.data || []);
      setOfficeDocs(officeDocsRes.data || []);
      setLoading(false);
    };
    load();
  }, [id]);

  const openEdit = () => {
    setForm({ ...contact });
    setEditing(true);
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const updates: Record<string, any> = {};
      const fields = [
        "full_name", "phone", "email", "cpf", "rg", "address", "origin", "contact_type",
        "birth_date", "civil_status", "tags", "ctps", "pis", "titulo_eleitor",
        "cnh", "passaporte", "certidao_reservista", "atividade_economica",
        "nome_pai", "nome_mae", "naturalidade", "nacionalidade", "comentarios",
        "banco", "agencia", "conta_bancaria", "chave_pix", "falecido",
      ];
      fields.forEach((f) => {
        if (form[f] !== undefined) updates[f] = form[f] || null;
      });
      if (form.full_name) updates.full_name = form.full_name;
      if (typeof form.falecido === "boolean") updates.falecido = form.falecido;
      if (Array.isArray(form.tags)) updates.tags = form.tags;

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", id);
      if (error) throw error;

      setContact((prev: any) => ({ ...prev, ...updates }));
      setEditing(false);
      setNewPassword("");
      toast({ title: "Salvo!", description: "Dados do contato atualizados." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleOfficeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!id || !tenantId || !user) {
      toast({ title: "Erro", description: "Sessão expirada. Faça login novamente.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `contacts/${id}/${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage.from("case-documents").upload(filePath, file);
      if (uploadError) {
        toast({ title: "Erro no upload", description: uploadError.message, variant: "destructive" });
        return;
      }
      const { data: urlData } = supabase.storage.from("case-documents").getPublicUrl(filePath);
      const { data: docData, error: insertError } = await supabase
        .from("contact_documents")
        .insert({ contact_user_id: id, tenant_id: tenantId, name: file.name, file_url: urlData.publicUrl, uploaded_by: user.id, category: "Escritório" })
        .select()
        .single();
      if (insertError) {
        toast({ title: "Erro ao salvar documento", description: insertError.message, variant: "destructive" });
      } else if (docData) {
        setOfficeDocs((prev) => [docData, ...prev]);
        toast({ title: "Sucesso!", description: "Documento anexado." });
      }
    } catch (err: any) {
      toast({ title: "Erro inesperado", description: err.message || "Falha ao enviar arquivo.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAddLink = async () => {
    if (!linkName.trim() || !linkUrl.trim() || !id || !tenantId || !user) return;
    setAddingLink(true);
    const { data, error } = await supabase
      .from("contact_documents")
      .insert({ contact_user_id: id, tenant_id: tenantId, name: linkName.trim(), link_url: linkUrl.trim(), uploaded_by: user.id, category: "Escritório" })
      .select()
      .single();
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    if (data) { setOfficeDocs((prev) => [data, ...prev]); setLinkName(""); setLinkUrl(""); }
    setAddingLink(false);
  };

  const handleDeleteDoc = async (docId: string) => {
    const { error } = await supabase.from("contact_documents").delete().eq("id", docId);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else setOfficeDocs((prev) => prev.filter((d) => d.id !== docId));
  };
  const handleDeleteClientDoc = async (docId: string) => {
    const { error } = await supabase.from("documents").delete().eq("id", docId);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else setClientDocs((prev) => prev.filter((d) => d.id !== docId));
  };

  const handleDeleteClientFolder = async (caseId: string) => {
    const docsInFolder = clientDocs.filter((d) => (d.case_id || "sem-processo") === caseId);
    const ids = docsInFolder.map((d) => d.id);
    const { error } = await supabase.from("documents").delete().in("id", ids);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else setClientDocs((prev) => prev.filter((d) => !ids.includes(d.id)));
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id || !tenantId) return;
    setUploadingAvatar(true);
    try {
      const filePath = `avatars/${id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("case-documents").upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("case-documents").getPublicUrl(filePath);
      const { error: updateError } = await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("user_id", id);
      if (updateError) throw updateError;
      setContact((prev: any) => ({ ...prev, avatar_url: urlData.publicUrl }));
      toast({ title: "Foto atualizada!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handleExtractFromDoc = async (docId: string, fileUrl: string, useAi = false) => {
    if (!id) return;
    setExtractingDocId(docId);
    try {
      const { data, error } = await supabase.functions.invoke("extract-client-data", {
        body: { contact_user_id: id, document_id: docId, use_ai: useAi },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: data.updated === 0 ? "Informação" : "Erro", description: data.error, variant: data.updated === 0 ? "default" : "destructive" });
      } else if (data?.success) {
        const fieldNames: Record<string, string> = {
          cpf: "CPF", rg: "RG", address: "Endereço", phone: "Telefone", email: "Email",
          civil_status: "Estado civil", nacionalidade: "Nacionalidade", naturalidade: "Naturalidade",
          nome_mae: "Nome da mãe", nome_pai: "Nome do pai", birth_date: "Data de nascimento",
          cnh: "CNH", ctps: "CTPS", pis: "PIS", titulo_eleitor: "Título de eleitor", atividade_economica: "Profissão",
        };
        const updated = Object.keys(data.fields || {}).map((k) => fieldNames[k] || k).join(", ");
        toast({ title: `${data.updated} campo(s) atualizado(s)! (${data.method === "ai" ? "IA" : "Regex"})`, description: updated });
        // Reload contact data
        const { data: refreshed } = await supabase.from("profiles").select("*").eq("user_id", id).single();
        if (refreshed) setContact(refreshed);
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
        reader.onload = () => { resolve((reader.result as string).split(",")[1]); };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { data, error } = await supabase.functions.invoke("extract-client-data", {
        body: { contact_user_id: id, file_base64: base64, file_name: file.name, file_mime_type: file.type, use_ai: false },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: data.updated === 0 ? "Informação" : "Erro", description: data.error, variant: data.updated === 0 ? "default" : "destructive" });
      } else if (data?.success) {
        const fieldNames: Record<string, string> = {
          cpf: "CPF", rg: "RG", address: "Endereço", phone: "Telefone", email: "Email",
          civil_status: "Estado civil", nacionalidade: "Nacionalidade", naturalidade: "Naturalidade",
          nome_mae: "Nome da mãe", nome_pai: "Nome do pai", birth_date: "Data de nascimento",
          cnh: "CNH", ctps: "CTPS", pis: "PIS", titulo_eleitor: "Título de eleitor", atividade_economica: "Profissão",
        };
        const updated = Object.keys(data.fields || {}).map((k) => fieldNames[k] || k).join(", ");
        toast({ title: `${data.updated} campo(s) atualizado(s)!`, description: updated });
        const { data: refreshed } = await supabase.from("profiles").select("*").eq("user_id", id).single();
        if (refreshed) setContact(refreshed);
      }
    } catch (err: any) {
      toast({ title: "Erro na extração", description: err.message, variant: "destructive" });
    } finally {
      setExtractingExternal(false);
      if (extractFileRef.current) extractFileRef.current.value = "";
    }
  };

  const handleExtractFromSelectedText = async (save = false) => {
    if (!extractText.trim() || extractText.trim().length < 10) {
      toast({ title: "Texto muito curto", description: "Cole ou digite o trecho com os dados de qualificação.", variant: "destructive" });
      return;
    }
    setExtractingText(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-selected-text", {
        body: { selected_text: extractText, contact_user_id: save ? id : undefined, preview_only: !save },
      });
      if (error) throw error;
      if (!data?.success) {
        toast({ title: "Aviso", description: data?.error || "Nenhum dado encontrado.", variant: "default" });
        setExtractPreview(null);
        return;
      }
      if (save && data.updated !== undefined) {
        const fieldNames: Record<string, string> = {
          cpf: "CPF", rg: "RG", address: "Endereço", phone: "Telefone", email: "Email",
          civil_status: "Estado civil", nacionalidade: "Nacionalidade", naturalidade: "Naturalidade",
          nome_mae: "Nome da mãe", nome_pai: "Nome do pai", birth_date: "Nascimento",
          cnh: "CNH", ctps: "CTPS", pis: "PIS", titulo_eleitor: "Título de eleitor", atividade_economica: "Profissão",
          certidao_reservista: "Reservista", passaporte: "Passaporte",
        };
        const updated = Object.keys(data.fields || {}).map((k) => fieldNames[k] || k).join(", ");
        toast({ title: data.updated > 0 ? `${data.updated} campo(s) atualizado(s)!` : "Nenhum campo novo", description: data.updated > 0 ? updated : "Todos os campos já estavam preenchidos." });
        if (data.updated > 0) {
          const { data: refreshed } = await supabase.from("profiles").select("*").eq("user_id", id).single();
          if (refreshed) setContact(refreshed);
        }
        setExtractPreview(null);
        setExtractText("");
        setShowTextExtract(false);
      } else {
        setExtractPreview(data.fields || {});
      }
    } catch (err: any) {
      toast({ title: "Erro na extração", description: err.message, variant: "destructive" });
    } finally {
      setExtractingText(false);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("pt-BR");

  const handleCopyQualificacao = () => {
    const c = contact;
    const toTitleCase = (s: string) => s.toLowerCase().replace(/(?:^|\s)\S/g, (ch) => ch.toUpperCase());
    const toTitleCaseAddress = (s: string) => {
      return s.toLowerCase()
        .replace(/(?:^|\s)\S/g, (ch) => ch.toUpperCase())
        .replace(/\/([a-z]{2})\b/gi, (_, uf) => '/' + uf.toUpperCase())
        .replace(/\b([a-z]{2})$/i, (uf) => uf.toUpperCase());
    };
    const low = (s: string) => s.toLowerCase();
    const parts: string[] = [];
    if (c.full_name) parts.push(c.full_name.toUpperCase());
    if (c.nacionalidade) parts.push(low(c.nacionalidade));
    if (c.civil_status) parts.push(low(c.civil_status));
    if (c.atividade_economica) parts.push(low(c.atividade_economica));
    if (c.cpf) parts.push(`inscrito(a) no CPF sob o nº ${c.cpf}`);
    if (c.rg) parts.push(`portador(a) do RG nº ${c.rg}`);
    if (c.ctps) parts.push(`CTPS nº ${c.ctps}`);
    if (c.pis) parts.push(`PIS/PASEP nº ${c.pis}`);
    if (c.titulo_eleitor) parts.push(`Título de Eleitor nº ${c.titulo_eleitor}`);
    if (c.cnh) parts.push(`CNH nº ${c.cnh}`);
    if (c.nome_mae) parts.push(`filho(a) de ${toTitleCase(c.nome_mae)}`);
    if (c.nome_pai && c.nome_mae) parts.push(`e de ${toTitleCase(c.nome_pai)}`);
    else if (c.nome_pai) parts.push(`filho(a) de ${toTitleCase(c.nome_pai)}`);
    if (c.naturalidade) parts.push(`natural de ${toTitleCase(c.naturalidade)}`);
    if (c.birth_date) parts.push(`nascido(a) em ${formatDate(c.birth_date)}`);
    if (c.address) parts.push(`residente e domiciliado(a) na ${toTitleCaseAddress(c.address)}`);
    if (c.email) parts.push(`e-mail: ${low(c.email)}`);
    if (c.phone) parts.push(`telefone: ${c.phone}`);
    const text = parts.join(", ") + ".";
    navigator.clipboard.writeText(text);
    toast({ title: "Qualificação copiada!", description: "Texto formatado para petição copiado para a área de transferência." });
  };

  if (loading) return <div className="text-muted-foreground text-sm p-4">Carregando...</div>;
  if (!contact) return <div className="text-muted-foreground text-sm p-4">Contato não encontrado.</div>;

  const renderField = (label: string, field: string, type = "text") => (
    <div key={field} className="flex items-center py-2.5 border-b last:border-0">
      <span className="w-48 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right pr-6 shrink-0">
        {label}
      </span>
      <div className="flex-1">
        {editing ? (
          type === "checkbox" ? (
            <input
              type="checkbox"
              checked={!!form[field]}
              onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.checked }))}
              className="w-4 h-4 rounded border accent-primary"
            />
          ) : type === "select" ? (
            <select
              value={form[field] || ""}
              onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
              className="h-8 px-2 rounded border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Selecione...</option>
              <option value="Solteiro(a)">Solteiro(a)</option>
              <option value="Casado(a)">Casado(a)</option>
              <option value="Divorciado(a)">Divorciado(a)</option>
              <option value="Viúvo(a)">Viúvo(a)</option>
              <option value="União Estável">União Estável</option>
            </select>
          ) : type === "origin-select" ? (
            <select
              value={form[field] || ""}
              onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
              className="h-8 px-2 rounded border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Selecione...</option>
              <option value="Indicação">Indicação</option>
              <option value="Google">Google</option>
              <option value="Instagram">Instagram</option>
              <option value="Facebook">Facebook</option>
              <option value="LinkedIn">LinkedIn</option>
              <option value="Site">Site</option>
              <option value="OAB">OAB</option>
              <option value="Outro">Outro</option>
            </select>
          ) : type === "contact-type-select" ? (
            <select
              value={form[field] || ""}
              onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
              className="h-8 px-2 rounded border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="Cliente">Cliente</option>
              <option value="Parte Contrária">Parte Contrária</option>
              <option value="Testemunha">Testemunha</option>
              <option value="Perito">Perito</option>
              <option value="Fornecedor">Fornecedor</option>
              <option value="Parceiro">Parceiro</option>
              <option value="Outro">Outro</option>
            </select>
          ) : (
            <input
              type={type}
              value={form[field] || ""}
              onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
              className="h-8 px-2 rounded border bg-background text-sm text-foreground w-full max-w-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          )
        ) : (
          <span className="text-sm text-foreground">
            {type === "checkbox"
              ? contact[field] ? "Sim" : ""
              : type === "date" && contact[field]
              ? formatDate(contact[field])
              : contact[field] || ""}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <Link to="/contatos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Link>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">{contact.full_name}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Criado em {formatDate(contact.created_at)}</p>
            <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold uppercase tracking-wide border border-primary/20">
              Tipo: {contact.contact_type || "Cliente"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button onClick={() => setEditing(false)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <X className="w-4 h-4" />
                </button>
                <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg gradient-accent text-accent-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                  <Save className="w-3.5 h-3.5" /> {saving ? "Salvando..." : "Salvar"}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleCopyQualificacao}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Copiar qualificação para petição"
                >
                  <Copy className="w-3.5 h-3.5" /> Copiar Qualificação
                </button>
                <button onClick={openEdit} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue="cadastro" className="w-full">
        <TabsList className="w-full justify-start bg-transparent border-b rounded-none h-auto p-0 gap-0">
          {[
            { value: "cadastro", label: "Cadastro" },
            { value: "documentos", label: "Documentos" },
            { value: "atendimentos", label: "Atendimentos" },
            { value: "processos", label: "Processos" },
            { value: "despesas", label: "Despesas" },
            { value: "honorarios", label: "Honorários" },
            { value: "timesheets", label: "Timesheets" },
            { value: "notificacoes", label: "Notificações" },
            { value: "senha", label: "Senha" },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm font-medium"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="cadastro" className="mt-6 space-y-4">
          {/* Extract from selected text */}
          <div className="bg-card border rounded-lg overflow-hidden">
            <button
              onClick={() => { setShowTextExtract(!showTextExtract); setExtractPreview(null); }}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-accent hover:bg-accent/5 transition-colors"
            >
              <MousePointerClick className="w-4 h-4" />
              Extrair dados de texto selecionado
              <span className="text-[10px] text-muted-foreground ml-auto">{showTextExtract ? "▲" : "▼"}</span>
            </button>
            {showTextExtract && (
              <div className="px-4 pb-4 space-y-3 border-t">
                <p className="text-xs text-muted-foreground pt-3">
                  Cole abaixo o trecho copiado do documento (tribunal, PDF, etc.) com os dados de qualificação do cliente.
                </p>
                <textarea
                  value={extractText}
                  onChange={(e) => { setExtractText(e.target.value); setExtractPreview(null); }}
                  placeholder="Cole aqui o texto com CPF, RG, endereço, estado civil, filiação, etc."
                  rows={5}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground resize-y focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExtractFromSelectedText(false)}
                    disabled={extractingText || extractText.trim().length < 10}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-accent/40 text-accent text-xs font-semibold hover:bg-accent/5 transition-colors disabled:opacity-50"
                  >
                    {extractingText ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardPaste className="w-3.5 h-3.5" />}
                    Visualizar dados
                  </button>
                  {extractPreview && Object.keys(extractPreview).length > 0 && (
                    <button
                      onClick={() => handleExtractFromSelectedText(true)}
                      disabled={extractingText}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-accent-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {extractingText ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Salvar no cadastro
                    </button>
                  )}
                </div>
                {extractPreview && (
                  <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-foreground mb-2">
                      {Object.keys(extractPreview).length} dado(s) encontrado(s):
                    </p>
                    {Object.entries(extractPreview).map(([key, value]) => {
                      const labels: Record<string, string> = {
                        cpf: "CPF", rg: "RG", address: "Endereço", phone: "Telefone", email: "Email",
                        civil_status: "Estado Civil", nacionalidade: "Nacionalidade", naturalidade: "Naturalidade",
                        nome_mae: "Nome da Mãe", nome_pai: "Nome do Pai", birth_date: "Nascimento",
                        cnh: "CNH", ctps: "CTPS", pis: "PIS", titulo_eleitor: "Título Eleitor",
                        atividade_economica: "Profissão", certidao_reservista: "Reservista", passaporte: "Passaporte",
                      };
                      return (
                        <div key={key} className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground w-28 text-right shrink-0">{labels[key] || key}:</span>
                          <span className="text-foreground font-medium">{value}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-card border rounded-lg divide-y">
            {/* Photo section */}
            <div className="flex items-center py-4 px-4">
              <span className="w-48 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right pr-6 shrink-0">
                FOTO DO PERFIL
              </span>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="w-16 h-16 rounded-full bg-muted flex items-center justify-center relative cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all group overflow-hidden disabled:opacity-50"
                title="Clique para alterar a foto"
              >
                {contact.avatar_url ? (
                  <>
                    <img src={contact.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                      <Camera className="w-5 h-5 text-white" />
                    </div>
                  </>
                ) : uploadingAvatar ? (
                  <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                ) : (
                  <Camera className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                )}
              </button>
            </div>

            {/* Contact info */}
            <div className="px-4">
              {renderField("E-mail", "email")}
              {renderField("Nome Completo", "full_name")}
              {renderField("Tipo de Contato", "contact_type", "contact-type-select")}
              {/* Phone with WhatsApp button */}
              <div className="flex items-center py-2.5 border-b">
                <span className="w-48 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right pr-6 shrink-0">
                  Telefone
                </span>
                <div className="flex-1 flex items-center gap-2">
                  {editing ? (
                    <input
                      type="text"
                      value={form.phone || ""}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="(00) 00000-0000"
                      className="h-8 px-2 rounded border bg-background text-sm text-foreground w-full max-w-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  ) : (
                    <span className="text-sm text-foreground">{contact.phone || ""}</span>
                  )}
                  {(editing ? form.phone : contact.phone) && (
                    <a
                      href={`https://wa.me/${(editing ? form.phone : contact.phone).replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-600 hover:bg-green-700 text-white text-[10px] font-semibold transition-colors shrink-0"
                      title="Enviar WhatsApp"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      WhatsApp
                    </a>
                  )}
                </div>
              </div>
              {renderField("Nascimento", "birth_date", "date")}
              {renderField("Estado Civil", "civil_status", "select")}
            </div>

            {/* Origin & Address */}
            <div className="px-4">
              {renderField("Origem", "origin", "origin-select")}
              {renderField("Endereço", "address")}
            </div>

            {/* Documents */}
            <div className="px-4">
              {renderField("CPF", "cpf")}
              {renderField("RG", "rg")}
              {renderField("CTPS", "ctps")}
              {renderField("PIS", "pis")}
              {renderField("Título de Eleitor", "titulo_eleitor")}
              {renderField("CNH", "cnh")}
              {renderField("Passaporte", "passaporte")}
              {renderField("Certidão Reservista", "certidao_reservista")}
            </div>

            {/* Additional info */}
            <div className="px-4">
              {renderField("Atividade Econômica", "atividade_economica")}
              {renderField("Nome do Pai", "nome_pai")}
              {renderField("Nome da Mãe", "nome_mae")}
              {renderField("Naturalidade", "naturalidade")}
              {renderField("Nacionalidade", "nacionalidade")}
              {renderField("Comentários", "comentarios")}
            </div>

            {/* Bank info */}
            <div className="px-4">
              <div className="py-2.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">CONTA BANCÁRIA</span>
              </div>
              {renderField("Banco", "banco")}
              {renderField("Agência", "agencia")}
              {renderField("Conta", "conta_bancaria")}
              {renderField("Chave PIX", "chave_pix")}
            </div>

            {/* Deceased */}
            <div className="px-4">
              {renderField("Contato Falecido?", "falecido", "checkbox")}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="processos" className="mt-6">
          <div className="bg-card border rounded-lg">
            {cases.length === 0 ? (
              <p className="text-sm text-muted-foreground p-6 text-center">Nenhum processo vinculado.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="px-4 py-3 font-medium">Número</th>
                    <th className="px-4 py-3 font-medium">Assunto</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Atualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link to={`/processos/${c.id}`} state={{ from: `/contatos/${id}` }} className="text-primary hover:underline font-mono text-xs">
                          {c.process_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-foreground">{c.subject || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                          {c.simple_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{formatDate(c.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        {/* Documentos tab */}
        <TabsContent value="documentos" className="mt-6 space-y-6">
          {/* Seção: Documentos anexados pelo cliente */}
          <div className="bg-card border rounded-lg">
            <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30 rounded-t-lg">
              <FolderOpen className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Documentos anexados pelo cliente</h3>
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">{clientDocs.length}</span>
            </div>
            {clientDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground p-6 text-center">Nenhum documento enviado pelo cliente.</p>
            ) : (
              <div>
                {(() => {
                  const grouped: Record<string, any[]> = {};
                  clientDocs.forEach((doc) => {
                    const key = doc.case_id || "sem-processo";
                    if (!grouped[key]) grouped[key] = [];
                    grouped[key].push(doc);
                  });
                  return Object.entries(grouped).map(([caseId, docs]) => {
                    const caseInfo = cases.find((c) => c.id === caseId);
                    const label = caseInfo ? caseInfo.process_number : "Sem processo vinculado";
                    return (
                      <details key={caseId} className="group border-b last:border-0">
                        <summary className="flex items-center gap-2 px-4 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors select-none">
                          <FolderOpen className="w-4 h-4 text-primary shrink-0 group-open:text-primary" />
                          <span className="text-sm font-medium text-foreground font-mono">{label}</span>
                          {caseInfo?.subject && <span className="text-xs text-muted-foreground truncate">— {caseInfo.subject}</span>}
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold shrink-0">{docs.length}</span>
                          <button
                            onClick={(e) => { e.preventDefault(); if (confirm(`Excluir todos os ${docs.length} documentos desta pasta?`)) handleDeleteClientFolder(caseId); }}
                            className="ml-2 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                            title="Excluir pasta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </summary>
                        <div className="divide-y border-t bg-muted/20">
                          {docs.map((doc) => (
                            <div key={doc.id} className="flex items-center gap-3 px-4 pl-10 py-2.5 hover:bg-muted/50 transition-colors">
                              <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                  <FileText className="w-3.5 h-3.5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                                  <p className="text-[10px] text-muted-foreground">{formatDate(doc.created_at)}</p>
                                </div>
                                <Download className="w-4 h-4 text-muted-foreground shrink-0" />
                              </a>
                              <button
                                onClick={() => handleDeleteClientDoc(doc.id)}
                                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                                title="Excluir documento"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </details>
                    );
                  });
                })()}
              </div>
            )}
          </div>

          {/* Seção: Documentos do escritório */}
          <div className="bg-card border rounded-lg">
            <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30 rounded-t-lg">
              <FolderOpen className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Documentos do escritório</h3>
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">{officeDocs.length}</span>
            </div>

            <div className="p-4 border-b space-y-3">
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleOfficeUpload} />
              <input ref={extractFileRef} type="file" className="hidden" accept=".pdf,image/*" onChange={handleExtractFromFile} />
              <div className="flex gap-2">
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  className="flex-1 flex items-center justify-center gap-2 bg-card rounded-lg border border-dashed border-primary/40 p-3 text-sm font-medium text-primary hover:bg-primary/5 transition-colors disabled:opacity-50">
                  {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</> : <><Upload className="w-4 h-4" /> Anexar arquivo</>}
                </button>
                <button onClick={() => extractFileRef.current?.click()} disabled={extractingExternal}
                  className="flex-1 flex items-center justify-center gap-2 bg-card rounded-lg border border-dashed border-accent/40 p-3 text-sm font-medium text-accent hover:bg-accent/5 transition-colors disabled:opacity-50">
                  {extractingExternal ? <><Loader2 className="w-4 h-4 animate-spin" /> Extraindo...</> : <><Sparkles className="w-4 h-4" /> Extrair dados de arquivo</>}
                </button>
              </div>

              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase">Nome do link</label>
                  <input value={linkName} onChange={(e) => setLinkName(e.target.value)} placeholder="Ex: Contrato"
                    className="h-8 px-2 rounded border bg-background text-sm text-foreground w-full focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase">URL</label>
                  <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..."
                    className="h-8 px-2 rounded border bg-background text-sm text-foreground w-full focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <button onClick={handleAddLink} disabled={addingLink || !linkName.trim() || !linkUrl.trim()}
                  className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1">
                  <Link2 className="w-3.5 h-3.5" /> Adicionar
                </button>
              </div>
            </div>

            {officeDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground p-6 text-center">Nenhum documento do escritório.</p>
            ) : (
              <div className="divide-y">
                {officeDocs.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      {doc.link_url ? <Link2 className="w-4 h-4 text-primary" /> : <FileText className="w-4 h-4 text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDate(doc.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {doc.file_url && (
                        <>
                          <button
                            onClick={() => handleExtractFromDoc(doc.id, doc.file_url, false)}
                            disabled={extractingDocId === doc.id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
                            title="Extrair dados do documento"
                          >
                            {extractingDocId === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                            Extrair
                          </button>
                        </>
                      )}
                      {(doc.file_url || doc.link_url) && (
                        <a href={doc.file_url || doc.link_url} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded hover:bg-muted transition-colors">
                          {doc.link_url ? <ExternalLink className="w-4 h-4 text-muted-foreground" /> : <Download className="w-4 h-4 text-muted-foreground" />}
                        </a>
                      )}
                      <button onClick={() => handleDeleteDoc(doc.id)} className="p-1.5 rounded hover:bg-destructive/10 transition-colors">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Placeholder tabs */}
        {["atendimentos", "despesas", "honorarios", "timesheets", "notificacoes"].map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-6">
            <div className="bg-card border rounded-lg p-8 text-center">
              <p className="text-sm text-muted-foreground">Em breve — funcionalidade de {tab} será implementada.</p>
            </div>
          </TabsContent>
        ))}

        {/* Senha tab */}
        <TabsContent value="senha" className="mt-6">
          <div className="bg-card border rounded-lg p-6 max-w-md">
            <h3 className="text-sm font-semibold text-foreground mb-4">Alterar Senha do Contato</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nova Senha</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="mt-1 h-9 px-3 rounded border bg-background text-sm text-foreground w-full focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <button
                onClick={async () => {
                  if (!id || !newPassword || newPassword.length < 6) {
                    toast({ title: "Erro", description: "A senha deve ter no mínimo 6 caracteres.", variant: "destructive" });
                    return;
                  }
                  setSaving(true);
                  try {
                    const { data: sessionData } = await supabase.auth.getSession();
                    const token = sessionData?.session?.access_token;
                    const res = await fetch(
                      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-client-password`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ userId: id, password: newPassword }),
                      }
                    );
                    const result = await res.json();
                    if (!res.ok) throw new Error(result.error || "Erro ao atualizar senha");
                    setNewPassword("");
                    toast({ title: "Sucesso!", description: "Senha atualizada com sucesso." });
                  } catch (err: any) {
                    toast({ title: "Erro", description: err.message, variant: "destructive" });
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" /> {saving ? "Salvando..." : "Atualizar Senha"}
              </button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ContatoDetail;
