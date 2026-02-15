import { useState, useEffect } from "react";
import { Mail, Copy, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function generateApiKeySync(tenantId: string): string {
  // Simple deterministic hash for display - matches edge function logic
  let hash = 0;
  const str = `lovable-email-${tenantId}-integration`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  // We need SHA-256 to match the server, so we'll compute it async
  return '';
}

const EmailIntegrationSetup = () => {
  const { tenantId } = useAuth();
  const { toast } = useToast();
  const [showScript, setShowScript] = useState(false);
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    if (!tenantId) return;
    // Generate matching API key (SHA-256)
    const encoder = new TextEncoder();
    const data = encoder.encode(`lovable-email-${tenantId}-integration`);
    crypto.subtle.digest('SHA-256', data).then(hashBuffer => {
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      setApiKey(hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32));
    });
  }, [tenantId]);

  const getGoogleScript = () => {
    return `// ============================================
// CAPTURA AUTOMÁTICA DE PUBLICAÇÕES - Google Apps Script
// Cole este script em: https://script.google.com
// ============================================

// ⚠️ NÃO ALTERE ESTAS CONFIGURAÇÕES ⚠️
var CONFIG = {
  ENDPOINT: "${SUPABASE_URL}/functions/v1/parse-email-publications",
  TENANT_ID: "${tenantId}",
  API_KEY: "${apiKey}",
  // Remetentes dos tribunais (adicione mais conforme necessário)
  SENDERS: [
    "noreply@trf4.jus.br",
    "intimacao@trf4.jus.br",
    "dje@trf4.jus.br",
    "expediente@trf4.jus.br",
    "noreply@tjrs.jus.br",
    "intimacao@tjrs.jus.br",
    "dje@tjrs.jus.br",
    "push@stj.jus.br",
    "noreply@stj.jus.br",
    "push@tst.jus.br",
    "noreply@cnj.jus.br",
    "diario@trf4.jus.br"
  ]
};

// Função principal - roda automaticamente a cada hora
function processCourtEmails() {
  var label = GmailApp.getUserLabelByName("JurisCapturado");
  if (!label) {
    label = GmailApp.createLabel("JurisCapturado");
  }
  
  // Buscar emails dos últimos 2 dias dos remetentes dos tribunais
  var queries = CONFIG.SENDERS.map(function(s) { return "from:" + s; });
  var searchQuery = "(" + queries.join(" OR ") + ") newer_than:2d -label:JurisCapturado";
  
  var threads = GmailApp.search(searchQuery, 0, 20);
  Logger.log("Encontrados " + threads.length + " emails de tribunais");
  
  var totalFound = 0;
  
  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    for (var j = 0; j < messages.length; j++) {
      var msg = messages[j];
      var result = sendToApi(
        msg.getPlainBody(),
        msg.getSubject(),
        msg.getFrom()
      );
      if (result && result.found > 0) {
        totalFound += result.found;
      }
    }
    // Marcar como processado
    threads[i].addLabel(label);
  }
  
  if (totalFound > 0) {
    Logger.log("✅ Total: " + totalFound + " publicações capturadas");
  }
}

function sendToApi(body, subject, from) {
  try {
    var payload = {
      email_body: body.substring(0, 50000),
      email_subject: subject,
      email_from: from,
      tenant_id: CONFIG.TENANT_ID,
      api_key: CONFIG.API_KEY
    };
    
    var options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    var response = UrlFetchApp.fetch(CONFIG.ENDPOINT, options);
    var result = JSON.parse(response.getContentText());
    Logger.log("Resposta: " + JSON.stringify(result));
    return result;
  } catch (e) {
    Logger.log("Erro: " + e.message);
    return null;
  }
}

// Criar trigger automático (execute esta função UMA VEZ manualmente)
function criarTriggerAutomatico() {
  // Remove triggers existentes
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "processCourtEmails") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  // Cria trigger a cada 1 hora
  ScriptApp.newTrigger("processCourtEmails")
    .timeBased()
    .everyHours(1)
    .create();
  Logger.log("✅ Trigger criado! O script rodará automaticamente a cada hora.");
}`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getGoogleScript());
    toast({ title: "Copiado!", description: "Cole no Google Apps Script." });
  };

  if (!tenantId || !apiKey) return null;

  return (
    <div className="bg-card rounded-lg border p-5 shadow-card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Mail className="w-4 h-4 text-accent" /> Captura Automática via Email
        </h2>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-medium">
          100% Automático
        </span>
      </div>

      <p className="text-sm text-muted-foreground">
        Configure uma vez e receba publicações automaticamente. O sistema lê os emails dos tribunais 
        no seu Gmail e extrai as publicações a cada hora, sem intervenção manual.
      </p>

      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Setup rápido (2 minutos):</h3>
        <ol className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">1</span>
            <span>
              Acesse <a href="https://script.google.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline font-medium">script.google.com</a> com 
              o Gmail que recebe as intimações
            </span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">2</span>
            <span>Clique em <strong>"Novo projeto"</strong>, apague o conteúdo e cole o script abaixo</span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">3</span>
            <span>No menu suspenso de funções, selecione <strong>"criarTriggerAutomatico"</strong> e clique em <strong>▶ Executar</strong></span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">4</span>
            <span>Autorize o acesso ao Gmail quando solicitado</span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center flex-col">
              <CheckCircle className="w-3.5 h-3.5" />
            </span>
            <span className="text-foreground font-medium">Pronto! A cada hora, as publicações serão importadas automaticamente.</span>
          </li>
        </ol>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleCopy} variant="default" className="gap-2">
          <Copy className="w-4 h-4" /> Copiar Script
        </Button>
        <Button 
          onClick={() => setShowScript(!showScript)} 
          variant="outline" 
          className="gap-2"
        >
          {showScript ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {showScript ? "Ocultar" : "Ver script"}
        </Button>
      </div>

      {showScript && (
        <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto max-h-96 overflow-y-auto font-mono leading-relaxed">
          {getGoogleScript()}
        </pre>
      )}

      <p className="text-xs text-muted-foreground border-t border-border pt-3">
        <strong>Remetentes monitorados:</strong> TRF4, TJRS, STJ, TST, CNJ. 
        Você pode adicionar mais remetentes editando a lista <code>SENDERS</code> no script.
      </p>
    </div>
  );
};

export default EmailIntegrationSetup;
