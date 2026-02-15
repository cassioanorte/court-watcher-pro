import { useState, useEffect } from "react";
import { Mail, Save, CheckCircle, Loader2, Settings2, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

const EmailIntegrationSetup = () => {
  const { tenantId } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [existing, setExisting] = useState<EmailCredential | null>(null);
  const [provider, setProvider] = useState("gmail");
  const [form, setForm] = useState({
    imap_host: "imap.gmail.com",
    imap_port: 993,
    imap_user: "",
    imap_password: "",
    use_tls: true,
  });

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
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      if (data) {
        const cred = data as any as EmailCredential;
        setExisting(cred);
        setForm({
          imap_host: cred.imap_host,
          imap_port: cred.imap_port,
          imap_user: cred.imap_user,
          imap_password: cred.imap_password,
          use_tls: cred.use_tls,
        });
        // Detect provider
        const match = Object.entries(PROVIDER_PRESETS).find(([, v]) => v.host === cred.imap_host);
        setProvider(match ? match[0] : "custom");
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

  const handleSave = async () => {
    if (!tenantId || !form.imap_user || !form.imap_password || !form.imap_host) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        tenant_id: tenantId,
        ...form,
        is_active: true,
      };

      if (existing) {
        const { error } = await supabase
          .from("email_credentials" as any)
          .update(payload as any)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("email_credentials" as any)
          .insert(payload as any);
        if (error) throw error;
      }

      toast({ title: "Salvo!", description: "Credenciais de email configuradas com sucesso." });
      await fetchCredentials();
      setShowForm(false);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const response = await supabase.functions.invoke("poll-email-imap", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { tenant_id: tenantId },
      });

      if (response.error) throw new Error(response.error.message);

      const result = response.data?.results?.[0];
      toast({
        title: "Teste concluído",
        description: result?.error
          ? `Erro: ${result.error}`
          : `${result?.found || 0} publicações encontradas, ${result?.inserted || 0} inseridas.`,
      });
      await fetchCredentials();
    } catch (err: any) {
      toast({ title: "Erro no teste", description: err.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    try {
      const { error } = await supabase
        .from("email_credentials" as any)
        .delete()
        .eq("id", existing.id);
      if (error) throw error;
      setExisting(null);
      setForm({ imap_host: "imap.gmail.com", imap_port: 993, imap_user: "", imap_password: "", use_tls: true });
      setProvider("gmail");
      toast({ title: "Removido", description: "Credenciais de email removidas." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  if (!tenantId) return null;
  if (loading) return null;

  // Configured state
  if (existing && !showForm) {
    return (
      <div className="bg-card rounded-lg border p-5 shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Mail className="w-4 h-4 text-accent" /> Captura Automática via Email
          </h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-medium flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Configurado
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Monitorando <strong>{existing.imap_user}</strong> via {existing.imap_host}.
          {existing.last_polled_at && (
            <span className="block text-xs mt-1">
              Última verificação: {new Date(existing.last_polled_at).toLocaleString("pt-BR")}
            </span>
          )}
        </p>
        <div className="flex gap-2">
          <Button onClick={handleTest} disabled={testing} variant="default" size="sm" className="gap-2">
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            {testing ? "Verificando..." : "Verificar agora"}
          </Button>
          <Button onClick={() => setShowForm(true)} variant="outline" size="sm" className="gap-2">
            <Settings2 className="w-4 h-4" /> Editar
          </Button>
          <Button onClick={handleDelete} variant="ghost" size="sm" className="gap-2 text-destructive hover:text-destructive">
            <Trash2 className="w-4 h-4" /> Remover
          </Button>
        </div>
      </div>
    );
  }

  // Setup form
  return (
    <div className="bg-card rounded-lg border p-5 shadow-card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Mail className="w-4 h-4 text-accent" /> Captura Automática via Email
        </h2>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-medium">
          Qualquer provedor
        </span>
      </div>

      <p className="text-sm text-muted-foreground">
        Configure o email que recebe as intimações dos tribunais. O sistema verificará automaticamente
        novas publicações. Funciona com <strong>Gmail, Outlook, Yahoo</strong> ou qualquer email IMAP.
      </p>

      <div className="bg-muted/50 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Provedor</Label>
            <Select value={provider} onValueChange={handleProviderChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
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
                <Input
                  placeholder="imap.seuservidor.com"
                  value={form.imap_host}
                  onChange={e => setForm(prev => ({ ...prev, imap_host: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Porta</Label>
                <Input
                  type="number"
                  value={form.imap_port}
                  onChange={e => setForm(prev => ({ ...prev, imap_port: parseInt(e.target.value) || 993 }))}
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              placeholder="advogado@exemplo.com"
              value={form.imap_user}
              onChange={e => setForm(prev => ({ ...prev, imap_user: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>
              Senha {provider === "gmail" && <span className="text-xs text-muted-foreground">(senha de app)</span>}
            </Label>
            <Input
              type="password"
              placeholder="••••••••"
              value={form.imap_password}
              onChange={e => setForm(prev => ({ ...prev, imap_password: e.target.value }))}
            />
          </div>
        </div>

        {provider === "gmail" && (
          <div className="text-xs text-muted-foreground bg-amber-500/10 border border-amber-500/20 rounded p-3">
            <strong>Gmail requer "Senha de App"</strong>: Acesse{" "}
            <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              myaccount.google.com/apppasswords
            </a>
            , crie uma senha de aplicativo e use-a aqui ao invés da senha normal.
          </div>
        )}

        {provider === "outlook" && (
          <div className="text-xs text-muted-foreground bg-blue-500/10 border border-blue-500/20 rounded p-3">
            <strong>Outlook / Microsoft 365</strong>: Verifique se o acesso IMAP está habilitado nas configurações da sua conta.
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Salvando..." : "Salvar e ativar"}
        </Button>
        {existing && (
          <Button onClick={() => setShowForm(false)} variant="outline">
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
};

export default EmailIntegrationSetup;
