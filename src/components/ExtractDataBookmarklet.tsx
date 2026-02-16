import { useState } from "react";
import { Copy, CheckCircle, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function getExtractBookmarkletCode(): string {
  const code = `
(function(){
  var pdfUrl=null;
  var imgUrl=null;
  var embeds=document.querySelectorAll('embed[type="application/pdf"],embed[src*=".pdf"],object[type="application/pdf"],iframe[src*=".pdf"]');
  if(embeds.length>0){pdfUrl=embeds[0].src||embeds[0].data;}
  if(!pdfUrl){var links=document.querySelectorAll('a[href*=".pdf"]');if(links.length>0){pdfUrl=links[0].href;}}

  /* Also look for large images (scanned docs) */
  if(!pdfUrl){
    var imgs=document.querySelectorAll('img');
    var largest=null;var largestArea=0;
    for(var i=0;i<imgs.length;i++){
      var area=imgs[i].naturalWidth*imgs[i].naturalHeight;
      if(area>largestArea&&imgs[i].naturalWidth>400){largestArea=area;largest=imgs[i];}
    }
    if(largest&&largestArea>200000){imgUrl=largest.src;}
  }

  /* Also check for canvas elements (some viewers render to canvas) */
  if(!pdfUrl&&!imgUrl){
    var canvases=document.querySelectorAll('canvas');
    if(canvases.length>0){
      var biggest=null;var biggestArea=0;
      for(var c=0;c<canvases.length;c++){
        var ca=canvases[c].width*canvases[c].height;
        if(ca>biggestArea){biggestArea=ca;biggest=canvases[c];}
      }
      if(biggest&&biggestArea>200000){
        try{imgUrl=biggest.toDataURL('image/png');}catch(e){console.log('Canvas tainted');}
      }
    }
  }

  function sendToBackend(base64,mimeType,fileName){
    var statusDiv=document.createElement('div');
    statusDiv.style.cssText='position:fixed;top:20px;right:20px;z-index:999999;background:#1a2332;color:#fff;padding:16px 24px;border-radius:12px;font-family:system-ui;font-size:14px;box-shadow:0 8px 32px rgba(0,0,0,0.3);display:flex;align-items:center;gap:8px;max-width:400px;';
    statusDiv.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8972e" stroke-width="2" style="animation:spin 1s linear infinite"><style>@keyframes spin{to{transform:rotate(360deg)}}</style><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Identificando cliente e extraindo dados (OCR + IA)...';
    document.body.appendChild(statusDiv);

    fetch('${SUPABASE_URL}/functions/v1/extract-client-data',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':'${SUPABASE_KEY}'},
      body:JSON.stringify({auto_identify:true,file_base64:base64,file_name:fileName,file_mime_type:mimeType})
    }).then(function(r){return r.json()}).then(function(d){
      statusDiv.remove();
      if(d.success&&d.updated>0){
        var fields=Object.keys(d.fields||{}).join(', ');
        alert('✅ Cliente: '+d.client_name+'\\n\\n'+d.updated+' campo(s) atualizado(s)!\\n\\nCampos: '+fields);
      }else if(d.success&&d.updated===0){
        alert('ℹ️ Cliente identificado: '+(d.client_name||'N/A')+'\\n\\nTodos os campos já estão preenchidos ou nenhum dado novo foi encontrado.');
      }else{
        alert('⚠️ '+(d.error||'Nenhum dado encontrado no documento.'));
      }
    }).catch(function(e){
      statusDiv.remove();
      alert('❌ Erro de conexão: '+e.message);
    });
  }

  function fetchAndSend(url,mime,name){
    var statusDiv=document.createElement('div');
    statusDiv.style.cssText='position:fixed;top:20px;right:20px;z-index:999999;background:#1a2332;color:#fff;padding:16px 24px;border-radius:12px;font-family:system-ui;font-size:14px;box-shadow:0 8px 32px rgba(0,0,0,0.3);';
    statusDiv.textContent='⏳ Baixando documento...';
    document.body.appendChild(statusDiv);

    fetch(url,{credentials:'include'}).then(function(r){
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
      sendToBackend(base64,mime,name);
    }).catch(function(e){
      statusDiv.remove();
      alert('❌ Erro ao baixar o documento: '+e.message);
    });
  }

  if(pdfUrl){
    fetchAndSend(pdfUrl,'application/pdf','documento.pdf');
  }else if(imgUrl){
    if(imgUrl.startsWith('data:')){
      /* Already base64 (from canvas) */
      var parts=imgUrl.split(',');
      var mime=parts[0].match(/:(.*?);/)[1];
      sendToBackend(parts[1],mime,'documento_digitalizado.png');
    }else{
      fetchAndSend(imgUrl,'image/jpeg','documento_digitalizado.jpg');
    }
  }else{
    alert('⚠️ Nenhum PDF ou imagem de documento encontrado nesta página.\\n\\nAbra o documento no tribunal (PDF ou imagem digitalizada) e tente novamente.');
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
        Abra um documento no <strong>tribunal</strong> — PDF ou página digitalizada (OCR) — e clique no favorito.
        O sistema <strong>identifica automaticamente</strong> o cliente e preenche os dados faltantes no cadastro.
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
              <span>Acesse o <strong>tribunal</strong> e abra o <strong>documento</strong> (PDF ou imagem digitalizada).</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">3</span>
              <span>Clique no favorito <strong>"📋 Extrair Dados do Cliente"</strong>.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">4</span>
              <span className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-success shrink-0" />
                Pronto! O sistema faz OCR + IA, identifica o cliente e preenche os dados.
              </span>
            </li>
          </ol>

          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              <strong>Funciona com:</strong> PDFs nativos, PDFs digitalizados (escaneados), imagens de documentos e páginas renderizadas em canvas.
              O cliente precisa estar cadastrado no sistema para ser identificado.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExtractDataBookmarklet;
