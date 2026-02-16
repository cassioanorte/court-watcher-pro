import { useState } from "react";
import { Bookmark, Copy, CheckCircle, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function getExtractBookmarkletCode(): string {
  const code = `
(function(){
  var NUM_PROMPT='Informe o número do processo (CNJ) vinculado ao cliente:';
  var processNumber=prompt(NUM_PROMPT);
  if(!processNumber||!processNumber.trim()){alert('❌ Número do processo é obrigatório.');return;}
  processNumber=processNumber.trim();

  /* Try to find PDF in page */
  var pdfUrl=null;
  var embeds=document.querySelectorAll('embed[type="application/pdf"],embed[src*=".pdf"],object[type="application/pdf"],iframe[src*=".pdf"]');
  if(embeds.length>0){pdfUrl=embeds[0].src||embeds[0].data;}
  if(!pdfUrl){var links=document.querySelectorAll('a[href*=".pdf"]');if(links.length>0){pdfUrl=links[0].href;}}

  function sendToBackend(base64,mimeType,fileName){
    var statusDiv=document.createElement('div');
    statusDiv.style.cssText='position:fixed;top:20px;right:20px;z-index:999999;background:#1a2332;color:#fff;padding:16px 24px;border-radius:12px;font-family:system-ui;font-size:14px;box-shadow:0 8px 32px rgba(0,0,0,0.3);display:flex;align-items:center;gap:8px;';
    statusDiv.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8972e" stroke-width="2" style="animation:spin 1s linear infinite"><style>@keyframes spin{to{transform:rotate(360deg)}}</style><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Extraindo dados do cliente...';
    document.body.appendChild(statusDiv);

    fetch('${SUPABASE_URL}/functions/v1/extract-client-data',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':'${SUPABASE_KEY}'},
      body:JSON.stringify({case_id:null,process_number:processNumber,file_base64:base64,file_name:fileName,file_mime_type:mimeType})
    }).then(function(r){return r.json()}).then(function(d){
      statusDiv.remove();
      if(d.success){
        var fields=Object.keys(d.fields||{}).join(', ');
        alert('✅ '+d.updated+' campo(s) atualizado(s) no cadastro do cliente!\\n\\nCampos: '+fields);
      }else{
        alert('⚠️ '+(d.error||'Nenhum dado encontrado no documento.'));
      }
    }).catch(function(e){
      statusDiv.remove();
      alert('❌ Erro de conexão: '+e.message);
    });
  }

  if(pdfUrl){
    /* Found embedded PDF - fetch it */
    var statusDiv=document.createElement('div');
    statusDiv.style.cssText='position:fixed;top:20px;right:20px;z-index:999999;background:#1a2332;color:#fff;padding:16px 24px;border-radius:12px;font-family:system-ui;font-size:14px;box-shadow:0 8px 32px rgba(0,0,0,0.3);';
    statusDiv.textContent='⏳ Baixando documento...';
    document.body.appendChild(statusDiv);

    fetch(pdfUrl,{credentials:'include'}).then(function(r){
      if(!r.ok)throw new Error('Falha ao baixar: '+r.status);
      return r.arrayBuffer();
    }).then(function(buf){
      statusDiv.remove();
      var bytes=new Uint8Array(buf);
      var binary='';
      var chunkSize=8192;
      for(var i=0;i<bytes.length;i+=chunkSize){
        binary+=String.fromCharCode.apply(null,bytes.slice(i,i+chunkSize));
      }
      var base64=btoa(binary);
      sendToBackend(base64,'application/pdf',processNumber+'_doc.pdf');
    }).catch(function(e){
      statusDiv.remove();
      alert('❌ Erro ao baixar o documento: '+e.message+'\\n\\nTente baixar o PDF manualmente e usar o botão de upload no sistema.');
    });
  }else{
    /* No PDF found - capture page as screenshot-like approach via HTML */
    alert('⚠️ Nenhum PDF encontrado nesta página.\\n\\nAbra o documento (PDF) no tribunal e tente novamente, ou baixe o PDF e use o botão "Upload e extrair" no detalhe do processo.');
  }
})();
  `.replace(/\n/g, "").replace(/\s+/g, " ").trim();
  return `javascript:${encodeURIComponent(code)}`;
}

const ExtractDataBookmarklet = () => {
  const { toast } = useToast();
  const [showInstructions, setShowInstructions] = useState(false);
  const bookmarkletUrl = getExtractBookmarkletCode();

  const handleCopyCode = () => {
    navigator.clipboard.writeText(bookmarkletUrl);
    toast({ title: "Copiado!", description: "Cole na barra de favoritos como URL de um novo favorito." });
  };

  return (
    <div className="bg-card rounded-lg border p-5 shadow-card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" /> Extração de Dados do Cliente (Bookmarklet)
        </h2>
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="text-xs text-accent hover:underline"
        >
          {showInstructions ? "Ocultar instruções" : "Como usar?"}
        </button>
      </div>

      <p className="text-sm text-muted-foreground">
        Abra um documento (petição inicial, procuração, etc.) diretamente no <strong>tribunal</strong> e clique no favorito para
        extrair automaticamente os dados de qualificação do cliente (CPF, RG, endereço, etc.) e preencher o cadastro.
      </p>

      <div className="flex items-center gap-3">
        <a
          href={bookmarkletUrl}
          onClick={(e) => e.preventDefault()}
          onDragStart={() => {}}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-accent-foreground text-sm font-semibold cursor-grab active:cursor-grabbing shadow-md hover:opacity-90 transition-opacity select-none"
          title="Arraste para a barra de favoritos"
        >
          <Sparkles className="w-4 h-4" /> 📋 Extrair Dados do Cliente
        </a>
        <button
          onClick={handleCopyCode}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs text-muted-foreground hover:text-foreground transition-colors"
          title="Copiar código do bookmarklet"
        >
          <Copy className="w-3.5 h-3.5" /> Copiar código
        </button>
      </div>

      {showInstructions && (
        <div className="bg-muted/50 rounded-lg p-4 space-y-3 text-sm">
          <h3 className="font-semibold text-foreground">Passo a passo:</h3>
          <ol className="space-y-2 text-muted-foreground">
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">1</span>
              <span><strong>Arraste</strong> o botão acima para sua barra de favoritos.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">2</span>
              <span>Acesse o <strong>tribunal</strong> (eproc, PJe, etc.) e abra o <strong>documento</strong> que contém os dados do cliente (ex: petição inicial).</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">3</span>
              <span>Com o documento <strong>aberto na tela</strong> (PDF visível), clique no favorito <strong>"📋 Extrair Dados do Cliente"</strong>.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">4</span>
              <span>Informe o <strong>número do processo</strong> (CNJ) quando solicitado.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">5</span>
              <span className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-success shrink-0" />
                Pronto! Os dados serão extraídos pela IA e preenchidos automaticamente no cadastro do cliente vinculado ao processo.
              </span>
            </li>
          </ol>

          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              <strong>Importante:</strong> O sistema só preenche campos que estejam <strong>vazios</strong> no cadastro do cliente, sem sobrescrever dados já preenchidos.
              Funciona com PDFs abertos no eproc (TRF4, TJRS) e em qualquer página que exiba um documento PDF embutido.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExtractDataBookmarklet;
