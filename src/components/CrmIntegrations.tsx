import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check, ExternalLink, Webhook, FileText, Code } from "lucide-react";

const CrmIntegrations = () => {
  const { tenantId } = useAuth();
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const webhookUrl = `${supabaseUrl}/functions/v1/lead-intake`;
  const formUrl = `${window.location.origin}/lead-form?t=${tenantId}`;

  const embedCode = `<iframe src="${formUrl}" width="100%" height="600" frameborder="0" style="border:none;border-radius:12px;max-width:480px;"></iframe>`;

  const examplePayload = JSON.stringify(
    {
      tenant_id: tenantId || "SEU_TENANT_ID",
      name: "João Silva",
      email: "joao@email.com",
      phone: "(51) 99999-0000",
      origin: "Google Ads",
      notes: "Interesse em consultoria trabalhista",
      estimated_value: 5000,
    },
    null,
    2
  );

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast({ title: "Copiado!" });
    setTimeout(() => setCopiedField(null), 2000);
  };

  const CopyButton = ({ text, field }: { text: string; field: string }) => (
    <button
      onClick={() => copyToClipboard(text, field)}
      className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      title="Copiar"
    >
      {copiedField === field ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Webhook className="w-4 h-4 text-accent" /> Canais de Entrada de Leads
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Conecte fontes externas (landing pages, Meta Ads, Google Ads, WhatsApp bots) para enviar leads direto ao CRM.
        </p>
      </div>

      {/* Webhook URL */}
      <div className="bg-card rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Webhook className="w-4 h-4 text-accent shrink-0" />
          <h4 className="text-sm font-semibold text-foreground">Webhook de Entrada</h4>
        </div>
        <p className="text-xs text-muted-foreground">
          Envie um POST com os dados do lead. Use no Zapier, n8n, Meta Ads Lead Forms, Google Ads, ou qualquer integração.
        </p>
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-2">
          <code className="text-xs font-mono text-foreground flex-1 break-all select-all">{webhookUrl}</code>
          <CopyButton text={webhookUrl} field="webhook" />
        </div>

        {/* Example payload */}
        <details className="group">
          <summary className="text-xs font-medium text-accent cursor-pointer flex items-center gap-1">
            <Code className="w-3 h-3" /> Ver exemplo de payload (JSON)
          </summary>
          <div className="mt-2 relative">
            <pre className="text-[11px] font-mono bg-muted/50 rounded-lg p-3 overflow-x-auto text-foreground">
              {examplePayload}
            </pre>
            <div className="absolute top-2 right-2">
              <CopyButton text={examplePayload} field="payload" />
            </div>
          </div>
        </details>

        {/* Fields reference */}
        <details className="group">
          <summary className="text-xs font-medium text-accent cursor-pointer flex items-center gap-1">
            <FileText className="w-3 h-3" /> Campos aceitos
          </summary>
          <div className="mt-2 text-xs text-muted-foreground space-y-1">
            <p><code className="text-foreground font-mono">tenant_id</code> <span className="text-destructive">*</span> — ID do escritório (obrigatório)</p>
            <p><code className="text-foreground font-mono">name</code> <span className="text-destructive">*</span> — Nome do lead (obrigatório)</p>
            <p><code className="text-foreground font-mono">email</code> — E-mail</p>
            <p><code className="text-foreground font-mono">phone</code> — Telefone</p>
            <p><code className="text-foreground font-mono">cpf</code> — CPF</p>
            <p><code className="text-foreground font-mono">company</code> — Empresa</p>
            <p><code className="text-foreground font-mono">origin</code> — Origem (ex: Google Ads, Meta Ads, WhatsApp)</p>
            <p><code className="text-foreground font-mono">notes</code> — Observações</p>
            <p><code className="text-foreground font-mono">estimated_value</code> — Valor estimado (número)</p>
          </div>
        </details>
      </div>

      {/* Public form */}
      <div className="bg-card rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-accent shrink-0" />
          <h4 className="text-sm font-semibold text-foreground">Formulário Público de Captura</h4>
        </div>
        <p className="text-xs text-muted-foreground">
          Formulário pronto com sua marca. Incorpore em landing pages, blogs ou compartilhe o link direto.
        </p>

        {/* Direct link */}
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Link direto</p>
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-2">
            <code className="text-xs font-mono text-foreground flex-1 break-all select-all">{formUrl}</code>
            <CopyButton text={formUrl} field="formUrl" />
            <a href={formUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Embed code */}
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Código para incorporar (iframe)</p>
          <div className="relative">
            <pre className="text-[11px] font-mono bg-muted/50 rounded-lg p-3 overflow-x-auto text-foreground">
              {embedCode}
            </pre>
            <div className="absolute top-2 right-2">
              <CopyButton text={embedCode} field="embed" />
            </div>
          </div>
        </div>
      </div>

      {/* Integration tips */}
      <div className="bg-muted/30 rounded-lg border border-dashed p-4 space-y-2">
        <h4 className="text-xs font-semibold text-foreground">💡 Dicas de integração</h4>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
          <li><strong>Meta Ads:</strong> Configure um webhook no Zapier/n8n para capturar Lead Forms e enviar ao webhook acima.</li>
          <li><strong>Google Ads:</strong> Use extensões de formulário + Zapier/n8n para repassar ao webhook.</li>
          <li><strong>WhatsApp:</strong> Bots como Twilio, Z-API ou Wati podem enviar dados ao webhook via API.</li>
          <li><strong>Landing Pages:</strong> Use o formulário embedável ou integre via webhook com seu builder (Unbounce, Elementor, etc.).</li>
        </ul>
      </div>
    </div>
  );
};

export default CrmIntegrations;
