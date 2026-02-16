import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Pencil, Trash2, Save, X, Camera } from "lucide-react";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ContatoDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { tenantId } = useAuth();
  const { toast } = useToast();
  const [contact, setContact] = useState<any>(null);
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const [profileRes, casesRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", id).single(),
        supabase.from("cases").select("*").eq("client_user_id", id).order("updated_at", { ascending: false }),
      ]);
      setContact(profileRes.data);
      setCases(casesRes.data || []);
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

      // Update password if provided
      if (newPassword && newPassword.length >= 6) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-client-password`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ userId: id, password: newPassword }),
          }
        );
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Erro ao atualizar senha");
      }

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

  const formatDate = (d: string) => new Date(d).toLocaleDateString("pt-BR");

  if (loading) return <div className="text-muted-foreground text-sm p-4">Carregando...</div>;
  if (!contact) return <div className="text-muted-foreground text-sm p-4">Contato não encontrado.</div>;

  const Field = ({ label, field, type = "text" }: { label: string; field: string; type?: string }) => (
    <div className="flex items-center py-2.5 border-b last:border-0">
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
          ) : type === "date" ? (
            <input
              type="date"
              value={form[field] || ""}
              onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
              className="h-8 px-2 rounded border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
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
              <Field label="E-mail" field="email" />
              <Field label="Nome Completo" field="full_name" />
              <Field label="Nascimento" field="birth_date" type="date" />
              <Field label="Estado Civil" field="civil_status" type="select" />
              {/* Password field - only in edit mode */}
              {editing && (
                <div className="flex items-center py-2.5 border-b">
                  <span className="w-48 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right pr-6 shrink-0">
                    NOVA SENHA
                  </span>
                  <div className="flex-1">
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="h-8 px-2 rounded border bg-background text-sm text-foreground w-full max-w-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Origin */}
            <div className="px-4">
              <Field label="Origem" field="origin" />
            </div>

            {/* Documents */}
            <div className="px-4">
              <Field label="CPF" field="cpf" />
              <Field label="RG" field="rg" />
              <Field label="CTPS" field="ctps" />
              <Field label="PIS" field="pis" />
              <Field label="Título de Eleitor" field="titulo_eleitor" />
              <Field label="CNH" field="cnh" />
              <Field label="Passaporte" field="passaporte" />
              <Field label="Certidão Reservista" field="certidao_reservista" />
            </div>

            {/* Additional info */}
            <div className="px-4">
              <Field label="Atividade Econômica" field="atividade_economica" />
              <Field label="Nome do Pai" field="nome_pai" />
              <Field label="Nome da Mãe" field="nome_mae" />
              <Field label="Naturalidade" field="naturalidade" />
              <Field label="Nacionalidade" field="nacionalidade" />
              <Field label="Comentários" field="comentarios" />
            </div>

            {/* Bank info */}
            <div className="px-4">
              <div className="py-2.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">CONTA BANCÁRIA</span>
              </div>
              <Field label="Banco" field="banco" />
              <Field label="Agência" field="agencia" />
              <Field label="Conta" field="conta_bancaria" />
              <Field label="Chave PIX" field="chave_pix" />
            </div>

            {/* Deceased */}
            <div className="px-4">
              <Field label="Contato Falecido?" field="falecido" type="checkbox" />
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

        {/* Placeholder tabs */}
        {["documentos", "atendimentos", "despesas", "honorarios", "timesheets", "notificacoes"].map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-6">
            <div className="bg-card border rounded-lg p-8 text-center">
              <p className="text-sm text-muted-foreground">Em breve — funcionalidade de {tab} será implementada.</p>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default ContatoDetail;
