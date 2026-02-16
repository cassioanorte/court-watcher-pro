import { useState } from "react";
import { Copy, CheckCircle, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function getExtractBookmarkletCode(): string {
  const code = `
(function(){
  var ENDPOINT='${SUPABASE_URL}/functions/v1/extract-client-data';
  var APIKEY='${SUPABASE_KEY}';

  function showStatus(msg){
    var d=document.getElementById('_ext_status');
    if(d)d.remove();
    d=document.createElement('div');
    d.id='_ext_status';
    d.style.cssText='position:fixed;top:20px;right:20px;z-index:999999;background:#1a2332;color:#fff;padding:16px 24px;border-radius:12px;font-family:system-ui;font-size:14px;box-shadow:0 8px 32px rgba(0,0,0,0.3);display:flex;align-items:center;gap:8px;max-width:420px;';
    d.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8972e" stroke-width="2" style="animation:spin 1s linear infinite;flex-shrink:0"><style>@keyframes spin{to{transform:rotate(360deg)}}</style><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> '+msg;
    document.body.appendChild(d);
    return d;
  }
  function hideStatus(){var d=document.getElementById('_ext_status');if(d)d.remove();}

  function sendToBackend(base64,mimeType,fileName){
    showStatus('Identificando cliente e extraindo dados (OCR + IA)...');
    fetch(ENDPOINT,{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':APIKEY},
      body:JSON.stringify({auto_identify:true,file_base64:base64,file_name:fileName,file_mime_type:mimeType})
    }).then(function(r){return r.json()}).then(function(d){
      hideStatus();
      if(d.success&&d.updated>0){
        var fields=Object.keys(d.fields||{}).join(', ');
        alert('✅ Cliente: '+d.client_name+'\\n\\n'+d.updated+' campo(s) atualizado(s)!\\n\\nCampos: '+fields);
      }else if(d.success&&d.updated===0){
        alert('ℹ️ Cliente: '+(d.client_name||'N/A')+'\\nTodos os campos já estão preenchidos.');
      }else{
        alert('⚠️ '+(d.error||'Nenhum dado encontrado.'));
      }
    }).catch(function(e){hideStatus();alert('❌ Erro: '+e.message);});
  }

  function fetchAndSend(url,mime,name){
    showStatus('Baixando documento...');
    fetch(url,{credentials:'include'}).then(function(r){
      if(!r.ok)throw new Error('HTTP '+r.status);
      return r.arrayBuffer();
    }).then(function(buf){
      var bytes=new Uint8Array(buf);
      var binary='';var cs=8192;
      for(var i=0;i<bytes.length;i+=cs){binary+=String.fromCharCode.apply(null,bytes.slice(i,i+cs));}
      sendToBackend(btoa(binary),mime,name);
    }).catch(function(e){hideStatus();alert('❌ Erro ao baixar: '+e.message);});
  }

  function imgToBase64(img){
    var c=document.createElement('canvas');
    c.width=img.naturalWidth||img.width;
    c.height=img.naturalHeight||img.height;
    var ctx=c.getContext('2d');
    ctx.drawImage(img,0,0);
    try{return c.toDataURL('image/png');}catch(e){return null;}
  }

  /* 1. Try PDF embeds */
  var pdfUrl=null;
  var el=document.querySelectorAll('embed[type="application/pdf"],embed[src*=".pdf"],object[type="application/pdf"],iframe[src*=".pdf"],iframe[src*="viewer"],iframe[src*="documento"],iframe[src*="doc"]');
  for(var i=0;i<el.length;i++){
    var s=el[i].src||el[i].data||'';
    if(s&&(s.indexOf('.pdf')>-1||el[i].type==='application/pdf')){pdfUrl=s;break;}
  }
  if(!pdfUrl){var plinks=document.querySelectorAll('a[href*=".pdf"]');if(plinks.length>0)pdfUrl=plinks[0].href;}

  if(pdfUrl){fetchAndSend(pdfUrl,'application/pdf','documento.pdf');return;}

  /* 2. Try images in current page - find all significant images */
  var allImgs=[];
  var pageImgs=document.querySelectorAll('img');
  for(var j=0;j<pageImgs.length;j++){
    var im=pageImgs[j];
    var w=im.naturalWidth||im.width||0;
    var h=im.naturalHeight||im.height||0;
    if(w>200&&h>200){allImgs.push({el:im,area:w*h,src:im.src});}
  }

  /* 3. Try images inside same-origin iframes */
  var iframes=document.querySelectorAll('iframe');
  for(var k=0;k<iframes.length;k++){
    try{
      var iDoc=iframes[k].contentDocument||iframes[k].contentWindow.document;
      if(iDoc){
        var iImgs=iDoc.querySelectorAll('img');
        for(var m=0;m<iImgs.length;m++){
          var ii=iImgs[m];
          var iw=ii.naturalWidth||ii.width||0;
          var ih=ii.naturalHeight||ii.height||0;
          if(iw>200&&ih>200){allImgs.push({el:ii,area:iw*ih,src:ii.src});}
        }
        /* Also check for canvas inside iframes */
        var iCanvases=iDoc.querySelectorAll('canvas');
        for(var n=0;n<iCanvases.length;n++){
          var ic=iCanvases[n];
          if(ic.width>200&&ic.height>200){
            try{var d=ic.toDataURL('image/png');allImgs.push({el:ic,area:ic.width*ic.height,src:d,isDataUrl:true});}catch(e){}
          }
        }
      }
    }catch(e){/* cross-origin iframe */}
  }

  /* 4. Try canvas elements in main page */
  var canvases=document.querySelectorAll('canvas');
  for(var p=0;p<canvases.length;p++){
    var cv=canvases[p];
    if(cv.width>200&&cv.height>200){
      try{var du=cv.toDataURL('image/png');allImgs.push({el:cv,area:cv.width*cv.height,src:du,isDataUrl:true});}catch(e){}
    }
  }

  /* Sort by area descending and pick largest */
  allImgs.sort(function(a,b){return b.area-a.area;});

  if(allImgs.length>0){
    var best=allImgs[0];
    if(best.isDataUrl||best.src.startsWith('data:')){
      var parts=best.src.split(',');
      var mimeMatch=parts[0].match(/:(.*?);/);
      var mime=mimeMatch?mimeMatch[1]:'image/png';
      sendToBackend(parts[1],mime,'documento_digitalizado.png');
    }else if(best.src.startsWith('blob:')){
      /* Handle blob URLs */
      showStatus('Capturando imagem...');
      fetch(best.src).then(function(r){return r.arrayBuffer();}).then(function(buf){
        var bytes=new Uint8Array(buf);
        var binary='';var cs=8192;
        for(var i=0;i<bytes.length;i+=cs){binary+=String.fromCharCode.apply(null,bytes.slice(i,i+cs));}
        sendToBackend(btoa(binary),'image/png','documento_digitalizado.png');
      }).catch(function(){
        /* Fallback: draw to canvas */
        var b64=imgToBase64(best.el);
        if(b64){var ps=b64.split(',');sendToBackend(ps[1],'image/png','documento_digitalizado.png');}
        else{hideStatus();alert('❌ Não foi possível capturar a imagem.');}
      });
    }else{
      /* Try drawing to canvas first (avoids CORS on fetch) */
      var b64=imgToBase64(best.el);
      if(b64){
        var ps=b64.split(',');
        var mm=ps[0].match(/:(.*?);/);
        sendToBackend(ps[1],mm?mm[1]:'image/png','documento_digitalizado.png');
      }else{
        /* Fallback: fetch the image URL */
        fetchAndSend(best.src,'image/jpeg','documento_digitalizado.jpg');
      }
    }
    return;
  }

  /* 5. Last resort: try to find iframe src that might be a document viewer */
  for(var q=0;q<iframes.length;q++){
    var isrc=iframes[q].src||'';
    if(isrc&&isrc.indexOf('about:')!==0&&isrc.indexOf('javascript:')!==0){
      /* Try opening iframe src directly */
      if(confirm('Não encontrei documento nesta página.\\n\\nDeseja tentar extrair do conteúdo do iframe?\\n\\nURL: '+isrc.substring(0,80)+'...')){
        fetchAndSend(isrc,'application/pdf','documento.pdf');
        return;
      }
    }
  }

  alert('⚠️ Nenhum documento encontrado nesta página.\\n\\nDicas:\\n• Abra o documento diretamente (clique para visualizar o PDF/imagem)\\n• Se o documento está dentro de um iframe, tente abri-lo em nova aba\\n• Você também pode baixar e usar o upload no sistema');
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
        Abra um documento no <strong>tribunal</strong> — PDF, imagem digitalizada ou página escaneada — e clique no favorito.
        O sistema faz <strong>OCR automático</strong>, identifica o cliente e preenche os dados faltantes.
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
              <span><strong>Arraste</strong> o botão acima para sua barra de favoritos (ou copie o código).</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">2</span>
              <span>No tribunal, <strong>abra o documento diretamente</strong> — clique para visualizar o PDF ou a imagem digitalizada.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">3</span>
              <span>Clique no favorito <strong>"📋 Extrair Dados do Cliente"</strong>.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">4</span>
              <span className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-success shrink-0" />
                Pronto! OCR + IA identifica o cliente e preenche os dados automaticamente.
              </span>
            </li>
          </ol>

          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              <strong>Compatível com:</strong> PDFs nativos, documentos digitalizados (escaneados), imagens de documentos, 
              visualizadores em canvas e iframes. O cliente precisa estar cadastrado no sistema.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              <strong>Dica:</strong> Se o documento não for detectado, tente abri-lo diretamente em uma nova aba (clique direito → "Abrir em nova aba").
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExtractDataBookmarklet;
