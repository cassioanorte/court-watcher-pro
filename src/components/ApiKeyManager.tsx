import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Key, Plus, Trash2, Copy, Check, Eye, EyeOff, RefreshCw, Shield } from "lucide-react";

interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

const ApiKeyManager = () => {
  const { tenantId, user } = useAuth();
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("API Key");
  const [showNewKey, setShowNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const ingestUrl = `${supabaseUrl}/functions/v1/ingest-data`;

  const fetchKeys = async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from("api_keys")
      .select("id, name, key_prefix, is_active, last_used_at, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    setKeys((data as ApiKeyRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchKeys(); }, [tenantId]);

  const generateKey = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let key = "lex_";
    for (let i = 0; i < 48; i++) key += chars.charAt(Math.floor(Math.random() * chars.length));
    return key;
  };

  const hashKey = async (key: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  };

  const handleCreate = async () => {
    if (!tenantId || !user) return;
    setCreating(true);
    try {
      const rawKey = generateKey();
      const keyHash = await hashKey(rawKey);
      const keyPrefix = rawKey.substring(0, 12);

      const { error } = await supabase.from("api_keys").insert({
        tenant_id: tenantId,
        created_by: user.id,
        name: newKeyName || "API Key",
        key_hash: keyHash,
        key_prefix: keyPrefix,
      });

      if (error) throw error;

      setShowNewKey(rawKey);
      setNewKeyName("API Key");
      setShowForm(false);
      await fetchKeys();
      toast({ title: "API Key gerada com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao gerar chave", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    const { error } = await supabase.from("api_keys").update({ is_active: false }).eq("id", id);
    if (error) {
      toast({ title: "Erro ao revogar", variant: "destructive" });
    } else {
      toast({ title: "Chave revogada" });
      fetchKeys();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("api_keys").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    } else {
      toast({ title: "Chave excluída" });
      fetchKeys();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Copiado!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const examplePayload = JSON.stringify({
    type: "movements",
    data: [{
      case_id: "UUID_DO_PROCESSO",
      title: "Juntada de petição",
      details: "Petição de recurso juntada aos autos",
      occurred_at: "2025-04-03T10:00:00Z",
      source_label: "eproc"
    }]
  }, null, 2);

  return (
    <div className="bg-card rounded-lg border p-5 shadow-card space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Key className="w-4 h-4 text-accent" /> API de Integração
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gere chaves de API para conectar sistemas externos (Claude, n8n, Zapier, etc.)
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg gradient-accent text-accent-foreground text-xs font-semibold hover:opacity-90"
        >
          <Plus className="w-3.5 h-3.5" /> Nova Chave
        </button>
      </div>

      {/* New key form */}
      {showForm && (
        <div className="bg-muted/30 rounded-lg border border-dashed p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Nome da chave</label>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Ex: Claude Eproc, Integração n8n"
              className="w-full mt-1 h-9 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg gradient-accent text-accent-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50"
            >
              <Shield className="w-3.5 h-3.5" /> {creating ? "Gerando..." : "Gerar Chave"}
            </button>
          </div>
        </div>
      )}

      {/* Show newly created key */}
      {showNewKey && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 space-y-2">
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            ⚠️ Copie esta chave agora! Ela não será exibida novamente.
          </p>
          <div className="flex items-center gap-2 bg-background rounded-lg p-2">
            <code className="text-xs font-mono text-foreground flex-1 break-all select-all">{showNewKey}</code>
            <button
              onClick={() => copyToClipboard(showNewKey)}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
            </button>
          </div>
          <button onClick={() => setShowNewKey(null)} className="text-xs text-muted-foreground hover:text-foreground">
            Fechar
          </button>
        </div>
      )}

      {/* Existing keys list */}
      {loading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : keys.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <Key className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-xs">Nenhuma chave de API criada ainda</p>
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div key={k.id} className={`flex items-center gap-3 p-3 rounded-lg border ${k.is_active ? "bg-background" : "bg-muted/30 opacity-60"}`}>
              <Key className={`w-4 h-4 shrink-0 ${k.is_active ? "text-accent" : "text-muted-foreground"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">{k.name}</p>
                <p className="text-[10px] text-muted-foreground font-mono">{k.key_prefix}••••••••</p>
                <p className="text-[10px] text-muted-foreground">
                  {k.is_active ? "✅ Ativa" : "🚫 Revogada"}
                  {k.last_used_at && ` • Último uso: ${new Date(k.last_used_at).toLocaleDateString("pt-BR")}`}
                </p>
              </div>
              <div className="flex gap-1">
                {k.is_active && (
                  <button
                    onClick={() => handleRevoke(k.id)}
                    className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    title="Revogar"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(k.id)}
                  className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  title="Excluir"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* API Documentation */}
      <details className="group">
        <summary className="text-xs font-semibold text-accent cursor-pointer flex items-center gap-1">
          📖 Documentação da API
        </summary>
        <div className="mt-3 space-y-3 text-xs text-muted-foreground">
          <div>
            <p className="font-semibold text-foreground mb-1">Endpoint</p>
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-2">
              <code className="font-mono text-foreground flex-1 break-all">POST {ingestUrl}</code>
              <button onClick={() => copyToClipboard(ingestUrl)} className="p-1 rounded hover:bg-muted">
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-1">Headers</p>
            <pre className="bg-muted/50 rounded-lg p-2 font-mono text-[11px] overflow-x-auto">
{`Content-Type: application/json
x-api-key: SUA_CHAVE_AQUI`}
            </pre>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-1">Tipos aceitos</p>
            <ul className="list-disc pl-4 space-y-1">
              <li><code className="text-foreground font-mono">movements</code> — Movimentações (case_id, title, occurred_at, details, source_label)</li>
              <li><code className="text-foreground font-mono">processes</code> — Processos (process_number, parties, subject, case_summary, source)</li>
              <li><code className="text-foreground font-mono">documents</code> — Documentos (case_id, name, file_url, category)</li>
              <li><code className="text-foreground font-mono">publications</code> — Publicações DJE (oab_number, title, publication_date, content, process_number, organ)</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-1">Exemplo de payload</p>
            <div className="relative">
              <pre className="bg-muted/50 rounded-lg p-3 font-mono text-[11px] overflow-x-auto text-foreground">
                {examplePayload}
              </pre>
              <button onClick={() => copyToClipboard(examplePayload)} className="absolute top-2 right-2 p-1 rounded hover:bg-muted">
                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
};

export default ApiKeyManager;
