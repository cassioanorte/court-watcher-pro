import { useState, useEffect } from "react";
import { Mail, Save, CheckCircle, Loader2, Settings2, Trash2, Plus, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EmailCredential {
  id: string;
  imap_host: string;
  imap_port: number;
  imap_user: string;
  imap_password: string;
  use_tls: boolean;
  is_active: boolean;
  last_polled_at: string | null;
}

const PROVIDER_PRESETS: Record<string, { host: string; port: number }> = {
  gmail: { host: "imap.gmail.com", port: 993 },
  outlook: { host: "outlook.office365.com", port: 993 },
  yahoo: { host: "imap.mail.yahoo.com", port: 993 },
  uol: { host: "imap.uol.com.br", port: 993 },
  terra: { host: "imap.terra.com.br", port: 993 },
  custom: { host: "", port: 993 },
};

const EMPTY_FORM = {
  imap_host: "imap.gmail.com",
  imap_port: 993,
  imap_user: "",
  imap_password: "",
  use_tls: true,
};

const EmailIntegrationSetup = () => {
  const { tenantId } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<EmailCredential[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null); // null = not editing, "new" = adding new
  const [provider, setProvider] = useState("gmail");
  const [form, setForm] = useState({ ...EMPTY_FORM });

  useEffect(() => {
    if (!tenantId) return;
    fetchCredentials();
  }, [tenantId]);

  const fetchCredentials = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("email_credentials" as any)
        .select("*")
        .eq("tenant_id", tenantId!);
      if (!error && data) {
        setCredentials(data as any as EmailCredential[]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = (val: string) => {
    setProvider(val);
    const preset = PROVIDER_PRESETS[val];
    if (preset && preset.host) {
      setForm(prev => ({ ...prev, imap_host: preset.host, imap_port: preset.port }));
    }
  };

  const startEdit = (cred: EmailCredential) => {
    setEditingId(cred.id);
    setForm({
      imap_host: cred.imap_host,
      imap_port: cred.imap_port,
      imap_user: cred.imap_user,
      imap_password: cred.imap_password,
      use_tls: cred.use_tls,
    });
    const match = Object.entries(PROVIDER_PRESETS).find(([, v]) => v.host === cred.imap_host);
    setProvider(match ? match[0] : "custom");
  };

  const startAdd = () => {
    setEditingId("new");
    setForm({ ...EMPTY_FORM });
    setProvider("gmail");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  };

  const handleSave = async () => {
    if (!tenantId || !form.imap_user || !form.imap_password || !form.imap_host) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = { tenant_id: tenantId, ...form, is_active: true };

      if (editingId && editingId !== "new") {
        const { error } = await supabase
          .from("email_credentials" as any)
          .update(payload as any)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("email_credentials" as any)
          .insert(payload as any);
        if (error) throw error;
      }

      toast({ title: "Salvo!", description: "Credenciais de email configuradas." });
      setEditingId(null);
      await fetchCredentials();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (credId?: string) => {
    const testId = credId || "all";
    setTesting(testId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const { data, error } = await supabase.functions.invoke("poll-email-imap", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { tenant_id: tenantId },
      });

      if (error) throw new Error(error.message);

      const results = data?.results || [];
      const total = results.reduce((s: number, r: any) => s + (r.inserted || 0), 0);
      const scanned = results.reduce((s: number, r: any) => s + (r.emails_scanned || 0), 0);

      toast({
        title: "Verificação concluída",
        description: total > 0
          ? `${total} publicação(ões) nova(s) em ${scanned} e-mail(s).`
          : `Nenhuma publicação nova (${scanned} e-mail(s) verificados).`,
      });
      await fetchCredentials();
    } catch (err: any) {
      toast({ title: "Erro no teste", description: err.message, variant: "destructive" });
    } finally {
      setTesting(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("email_credentials" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Removido", description: "Credenciais de email removidas." });
      await fetchCredentials();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  if (!tenantId) return null;
  if (loading) return null;

  const renderForm = () => (
    <div className="bg-muted/50 rounded-lg p-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Provedor</Label>
          <Select value={provider} onValueChange={handleProviderChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gmail">Gmail</SelectItem>
              <SelectItem value="outlook">Outlook / Microsoft 365</SelectItem>
              <SelectItem value="yahoo">Yahoo</SelectItem>
              <SelectItem value="uol">UOL</SelectItem>
              <SelectItem value="terra">Terra</SelectItem>
              <SelectItem value="custom">Outro (IMAP manual)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {provider === "custom" && (
          <>
            <div className="space-y-2">
              <Label>Servidor IMAP</Label>
              <Input placeholder="imap.seuservidor.com" value={form.imap_host}
                onChange={e => setForm(prev => ({ ...prev, imap_host: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Porta</Label>
              <Input type="number" value={form.imap_port}
                onChange={e => setForm(prev => ({ ...prev, imap_port: parseInt(e.target.value) || 993 }))} />
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label>Email</Label>
          <Input type="email" placeholder="advogado@exemplo.com" value={form.imap_user}
            onChange={e => setForm(prev => ({ ...prev, imap_user: e.target.value }))} />
        </div>

        <div className="space-y-2">
          <Label>
            Senha {provider === "gmail" && <span className="text-xs text-muted-foreground">(senha de app)</span>}
          </Label>
          <Input type="password" placeholder="••••••••" value={form.imap_password}
            onChange={e => setForm(prev => ({ ...prev, imap_password: e.target.value }))} />
        </div>
      </div>

      {provider === "gmail" && (
        <div className="text-xs text-muted-foreground bg-amber-500/10 border border-amber-500/20 rounded p-3 space-y-1">
          <strong>📋 Gmail — Passo a passo:</strong>
          <ol className="list-decimal list-inside space-y-0.5 ml-1">
            <li>Ative a <strong>verificação em duas etapas</strong> na sua conta Google</li>
            <li>Acesse{" "}
              <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline font-medium">
                myaccount.google.com/apppasswords
              </a>
            </li>
            <li>Crie uma nova senha de aplicativo (nome: "Portal Jurídico" ou similar)</li>
            <li>Copie a senha de 16 caracteres gerada e cole no campo <strong>Senha</strong> acima</li>
          </ol>
          <p className="mt-1 text-amber-600 dark:text-amber-400">⚠️ <strong>Não use a senha normal do Gmail</strong> — use apenas a senha de app gerada.</p>
        </div>
      )}

      {provider === "outlook" && (
        <div className="text-xs text-muted-foreground bg-blue-500/10 border border-blue-500/20 rounded p-3 space-y-1">
          <strong>📋 Outlook / Microsoft 365 — Passo a passo:</strong>
          <ol className="list-decimal list-inside space-y-0.5 ml-1">
            <li>Acesse <a href="https://outlook.live.com/mail/0/options/mail/accounts" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline font-medium">Configurações do Outlook</a></li>
            <li>Verifique se o <strong>acesso IMAP</strong> está habilitado</li>
            <li>Se usar autenticação em dois fatores, gere uma <strong>senha de app</strong> nas configurações de segurança</li>
            <li>Use seu e-mail completo e a senha (ou senha de app) nos campos acima</li>
          </ol>
        </div>
      )}

      {provider === "yahoo" && (
        <div className="text-xs text-muted-foreground bg-purple-500/10 border border-purple-500/20 rounded p-3 space-y-1">
          <strong>📋 Yahoo — Passo a passo:</strong>
          <ol className="list-decimal list-inside space-y-0.5 ml-1">
            <li>Acesse <a href="https://login.yahoo.com/account/security" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline font-medium">Segurança da conta Yahoo</a></li>
            <li>Gere uma <strong>senha de app</strong> para "Outro aplicativo"</li>
            <li>Cole a senha gerada no campo <strong>Senha</strong> acima</li>
          </ol>
        </div>
      )}

      {(provider === "uol" || provider === "terra" || provider === "custom") && (
        <div className="text-xs text-muted-foreground bg-muted border rounded p-3">
          <strong>💡 Dica:</strong> Use seu e-mail completo e senha de acesso. Se o provedor exigir senha de aplicativo, gere uma nas configurações de segurança da sua conta.
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Salvando..." : "Salvar"}
        </Button>
        <Button onClick={cancelEdit} variant="outline" className="gap-2">
          <X className="w-4 h-4" /> Cancelar
        </Button>
      </div>
    </div>
  );

  return (
    <div className="bg-card rounded-lg border p-5 shadow-card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Mail className="w-4 h-4 text-accent" /> E-mails Monitorados
        </h2>
        <div className="flex items-center gap-2">
          {credentials.length > 0 && (
            <Button onClick={() => handleTest()} disabled={!!testing} variant="default" size="sm" className="gap-2">
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              {testing ? "Verificando..." : "Verificar todos"}
            </Button>
          )}
          {editingId !== "new" && (
            <Button onClick={startAdd} variant="outline" size="sm" className="gap-2">
              <Plus className="w-4 h-4" /> Adicionar e-mail
            </Button>
          )}
        </div>
      </div>

      {credentials.length === 0 && editingId !== "new" && (
        <p className="text-sm text-muted-foreground">
          Nenhum e-mail configurado. Adicione os e-mails dos advogados que recebem publicações dos tribunais.
        </p>
      )}

      {/* List of configured emails */}
      {credentials.map(cred => (
        <div key={cred.id}>
          {editingId === cred.id ? (
            renderForm()
          ) : (
            <div className="flex items-center justify-between bg-muted/30 rounded-lg p-3 border">
              <div className="flex items-center gap-3 min-w-0">
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{cred.imap_user}</p>
                  <p className="text-xs text-muted-foreground">
                    {cred.imap_host}
                    {cred.last_polled_at && (
                      <> • Última verificação: {new Date(cred.last_polled_at).toLocaleString("pt-BR")}</>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button onClick={() => startEdit(cred)} variant="ghost" size="sm">
                  <Settings2 className="w-4 h-4" />
                </Button>
                <Button onClick={() => handleDelete(cred.id)} variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* New email form */}
      {editingId === "new" && renderForm()}
    </div>
  );
};

export default EmailIntegrationSetup;
