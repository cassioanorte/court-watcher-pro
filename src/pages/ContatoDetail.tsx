import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Pencil, Trash2, Save, X, Camera, Upload, FileText, Link2, Download, Loader2, ExternalLink, FolderOpen } from "lucide-react";
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
        "full_name", "phone", "email", "cpf", "rg", "address", "origin",
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
    if (!file || !id || !tenantId || !user) return;
    setUploading(true);
    const filePath = `contacts/${id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("case-documents").upload(filePath, file);
    if (uploadError) {
      toast({ title: "Erro", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("case-documents").getPublicUrl(filePath);
    const { data: docData, error: insertError } = await supabase
      .from("contact_documents")
      .insert({ contact_user_id: id, tenant_id: tenantId, name: file.name, file_url: urlData.publicUrl, uploaded_by: user.id, category: "Escritório" })
      .select()
      .single();
    if (insertError) toast({ title: "Erro", description: insertError.message, variant: "destructive" });
    if (docData) setOfficeDocs((prev) => [docData, ...prev]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
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

  const formatDate = (d: string) => new Date(d).toLocaleDateString("pt-BR");

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
              Tipo: Cliente
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
              <button onClick={openEdit} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <Pencil className="w-4 h-4" />
              </button>
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

        <TabsContent value="cadastro" className="mt-6">
          <div className="bg-card border rounded-lg divide-y">
            {/* Photo section */}
            <div className="flex items-center py-4 px-4">
              <span className="w-48 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right pr-6 shrink-0">
                FOTO DO PERFIL
              </span>
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                {contact.avatar_url ? (
                  <img src={contact.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <Camera className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
            </div>

            {/* Contact info */}
            <div className="px-4">
              {renderField("E-mail", "email")}
              {renderField("Nome Completo", "full_name")}
              {renderField("Nascimento", "birth_date", "date")}
              {renderField("Estado Civil", "civil_status", "select")}
            </div>

            {/* Origin */}
            <div className="px-4">
              {renderField("Origem", "origin", "origin-select")}
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
                        <Link to={`/processos/${c.id}`} className="text-primary hover:underline font-mono text-xs">
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
                          <span className="ml-auto text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold shrink-0">{docs.length}</span>
                        </summary>
                        <div className="divide-y border-t bg-muted/20">
                          {docs.map((doc) => (
                            <a key={doc.id} href={doc.file_url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-3 px-4 pl-10 py-2.5 hover:bg-muted/50 transition-colors">
                              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <FileText className="w-3.5 h-3.5 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                                <p className="text-[10px] text-muted-foreground">{formatDate(doc.created_at)}</p>
                              </div>
                              <Download className="w-4 h-4 text-muted-foreground shrink-0" />
                            </a>
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
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleOfficeUpload}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.xls,.xlsx,.txt" />
              <div className="flex gap-2">
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  className="flex-1 flex items-center justify-center gap-2 bg-card rounded-lg border border-dashed border-primary/40 p-3 text-sm font-medium text-primary hover:bg-primary/5 transition-colors disabled:opacity-50">
                  {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</> : <><Upload className="w-4 h-4" /> Anexar arquivo</>}
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
