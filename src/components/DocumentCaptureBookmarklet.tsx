import { useState } from "react";
import { FileSearch, ExternalLink, CheckCircle, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function getDocCaptureBookmarkletCode(tenantId: string): string {
  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  // Bookmarklet extracts document links and sends payload across domains via popup window.name
  const code = `
(function(){
  var docs=[];
  var cnj=(document.body.innerText.match(/\\d{7}-\\d{2}\\.\\d{4}\\.\\d\\.\\d{2}\\.\\d{4}/)||[''])[0];
  if(!cnj){alert('⚠️ Número do processo não encontrado na página.');return;}
  var rows=document.querySelectorAll('tr[id^="trEvento"]');
  if(rows.length===0){rows=document.querySelectorAll('table tr');}
  for(var i=0;i<rows.length;i++){
    var r=rows[i];
    var evtMatch=r.id?r.id.match(/trEvento(\\d+)/):null;
    var evtNum=evtMatch?evtMatch[1]:'';
    var links=r.querySelectorAll('a[href]');
    for(var j=0;j<links.length;j++){
      var a=links[j];
      var href=a.href||'';
      var name=(a.textContent||'').trim();
      if(name.length<2) continue;
      if(href.indexOf('acao_documento')>=0||href.indexOf('documento')>=0||href.indexOf('.pdf')>=0||href.indexOf('infraGetId')>=0||href.indexOf('acao=')>=0){
        var tipo='outro';
        var upper=name.toUpperCase();
        if(upper.indexOf('RPV')>=0||upper.indexOf('REQUISIÇÃO DE PEQUENO VALOR')>=0||upper.indexOf('REQUISICAO DE PEQUENO VALOR')>=0) tipo='rpv';
        else if(upper.indexOf('PRECATÓRIO')>=0||upper.indexOf('PRECATORIO')>=0) tipo='precatorio';
        else if(upper.indexOf('ALVARÁ')>=0||upper.indexOf('ALVARA')>=0) tipo='alvara';
        var feeType='contratuais';
        if(upper.indexOf('SUCUMB')>=0) feeType='sucumbencia';
        docs.push({name:name.substring(0,200),url:href,event_number:evtNum,doc_type:tipo,fee_type:feeType});
      }
    }
  }
  if(docs.length===0){
    var allLinks=document.querySelectorAll('a[href]');
    for(var k=0;k<allLinks.length;k++){
      var al=allLinks[k];
      var h=al.href||'';
      var n=(al.textContent||'').trim();
      if(n.length<2) continue;
      var u=n.toUpperCase();
      if(u.indexOf('RPV')>=0||u.indexOf('PRECATÓRIO')>=0||u.indexOf('PRECATORIO')>=0||u.indexOf('ALVARÁ')>=0||u.indexOf('ALVARA')>=0||u.indexOf('SENTENÇA')>=0||u.indexOf('SENTENCA')>=0||u.indexOf('DECISÃO')>=0||u.indexOf('DECISAO')>=0||u.indexOf('DESPACHO')>=0||u.indexOf('PETIÇÃO')>=0||u.indexOf('PETICAO')>=0){
        var tipo2='outro';
        if(u.indexOf('RPV')>=0||u.indexOf('REQUISIÇÃO DE PEQUENO VALOR')>=0) tipo2='rpv';
        else if(u.indexOf('PRECATÓRIO')>=0||u.indexOf('PRECATORIO')>=0) tipo2='precatorio';
        else if(u.indexOf('ALVARÁ')>=0||u.indexOf('ALVARA')>=0) tipo2='alvara';
        var feeType2='contratuais';
        if(u.indexOf('SUCUMB')>=0) feeType2='sucumbencia';
        docs.push({name:n.substring(0,200),url:h,event_number:'',doc_type:tipo2,fee_type:feeType2});
      }
    }
  }
  if(docs.length===0){alert('📄 Nenhum documento identificado na página.\\n\\nCertifique-se de estar na página de detalhes do processo no eproc.');return;}

  var payloadObj={docs:docs,process_number:cnj,tenant_id:'${tenantId}',source_url:window.location.href,bookmarklet_version:2};
  var payload=JSON.stringify(payloadObj);
  var targetOrigin='${appUrl}';
  var url=targetOrigin+'/documentos-eproc';
  var w=Math.min(800,screen.width-100);
  var h2=Math.min(700,screen.height-100);
  var left=(screen.width-w)/2;
  var top=(screen.height-h2)/2;

  var popup=window.open('about:blank','_docCapture','width='+w+',height='+h2+',left='+left+',top='+top+',scrollbars=yes,resizable=yes');
  if(!popup){alert('⚠️ O navegador bloqueou a popup. Permita popups para continuar.');return;}

  try{
    popup.name='lex_doc_capture:'+btoa(unescape(encodeURIComponent(payload)));
  }catch(e){
    popup.name='lex_doc_capture_raw:'+payload;
  }

  popup.location.href=url;

  var attempts=0;
  var maxAttempts=40;
  var sendPayload=function(){
    if(!popup||popup.closed) return true;
    try{
      popup.postMessage({type:'lex_doc_capture_payload',payload:payloadObj},targetOrigin);
    }catch(e){}
    attempts++;
    return attempts>=maxAttempts;
  };

  var timer=setInterval(function(){
    if(sendPayload()) clearInterval(timer);
  },250);

  var arrayBufferToBase64=function(buffer){
    var binary='';
    var bytes=new Uint8Array(buffer);
    var chunkSize=0x8000;
    for(var i=0;i<bytes.length;i+=chunkSize){
      binary+=String.fromCharCode.apply(null,bytes.subarray(i,i+chunkSize));
    }
    return btoa(binary);
  };

  var toAbsoluteUrl=function(url,baseUrl){
    try{return new URL(url,baseUrl||window.location.href).href;}catch(e){return url;}
  };

  var extractPdfUrlFromHtml=function(html,baseUrl){
    if(!html) return null;
    var patterns=[
      /(?:src|href)\\s*=\\s*["']([^"']+\\.pdf[^"']*)["']/i,
      /(?:src|href)\\s*=\\s*["']([^"']*(?:acao_documento|documento|download)[^"']*)["']/i,
      /window\\.open\\(\\s*["']([^"']+)["']/i,
      /location\\.href\\s*=\\s*["']([^"']+)["']/i
    ];

    for(var p=0;p<patterns.length;p++){
      var match=html.match(patterns[p]);
      if(match&&match[1]) return toAbsoluteUrl(match[1],baseUrl);
    }

    return null;
  };

  var fetchPdfResult=function(url){
    return fetch(url,{credentials:'include'})
      .then(function(resp){
        if(!resp.ok) throw new Error('HTTP '+resp.status);

        var contentType='';
        try{contentType=(resp.headers&&resp.headers.get('content-type'))||'';}catch(e){contentType='';}
        var normalizedType=String(contentType||'').toLowerCase();
        var finalUrl=resp.url||url;

        if(normalizedType.indexOf('application/pdf')>=0){
          return resp.arrayBuffer().then(function(buffer){
            return {buffer:buffer,contentType:contentType,finalUrl:finalUrl};
          });
        }

        return resp.text().then(function(html){
          return {html:html,contentType:contentType,finalUrl:finalUrl};
        });
      });
  };

  var onMessage=function(ev){
    if(!ev||!ev.data) return;

    if(ev.data.type==='lex_doc_capture_ready'){
      try{
        popup.postMessage({type:'lex_doc_capture_payload',payload:payloadObj},targetOrigin);
      }catch(e){}
      return;
    }

    if(ev.data.type!=='lex_doc_capture_fetch_pdf') return;
    if(ev.origin!==targetOrigin) return;

    var requestId=ev.data.requestId;
    var docUrl=ev.data.docUrl;
    var fileName=ev.data.fileName||'';

    if(!requestId||!docUrl) return;

    var resolvedDocUrl=toAbsoluteUrl(docUrl,window.location.href);

    fetchPdfResult(resolvedDocUrl)
      .then(function(result){
        if(result&&result.buffer) return result;

        var nestedUrl=extractPdfUrlFromHtml(result&&result.html?result.html:'',result&&result.finalUrl?result.finalUrl:resolvedDocUrl);
        if(!nestedUrl){
          throw new Error('Resposta sem PDF (content-type: '+((result&&result.contentType)||'desconhecido')+').');
        }

        return fetchPdfResult(nestedUrl).then(function(nested){
          if(nested&&nested.buffer) return nested;
          throw new Error('Não foi possível localizar o PDF final.');
        });
      })
      .then(function(result){
        var buffer=result.buffer;
        if(buffer.byteLength>8*1024*1024){
          throw new Error('Arquivo PDF acima do limite de 8MB para extração automática.');
        }
        var base64=arrayBufferToBase64(buffer);
        if(ev.source&&ev.source.postMessage){
          ev.source.postMessage({
            type:'lex_doc_capture_pdf_data',
            requestId:requestId,
            docUrl:docUrl,
            fileName:fileName,
            mime:'application/pdf',
            base64:base64
          },targetOrigin);
        }
      })
      .catch(function(err){
        if(ev.source&&ev.source.postMessage){
          ev.source.postMessage({
            type:'lex_doc_capture_pdf_error',
            requestId:requestId,
            docUrl:docUrl,
            error:(err&&err.message)?err.message:String(err)
          },targetOrigin);
        }
      });
  };

  window.addEventListener('message',onMessage);
  setTimeout(function(){
    try{window.removeEventListener('message',onMessage);}catch(e){}
  },300000);
})();
  `.replace(/\n/g, "").replace(/\s+/g, " ").trim();
  return `javascript:${encodeURIComponent(code)}`;
}

const DocumentCaptureBookmarklet = () => {
  const { toast } = useToast();
  const { tenantId } = useAuth();
  const [showInstructions, setShowInstructions] = useState(false);

  if (!tenantId) return null;

  const bookmarkletUrl = getDocCaptureBookmarkletCode(tenantId);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(bookmarkletUrl);
    toast({ title: "Copiado!", description: "Cole na barra de favoritos como URL de um novo favorito." });
  };

  return (
    <div className="bg-card rounded-lg border p-5 shadow-card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <FileSearch className="w-4 h-4 text-accent" /> Captura de Documentos (Bookmarklet)
        </h2>
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="text-xs text-accent hover:underline"
        >
          {showInstructions ? "Ocultar instruções" : "Como usar?"}
        </button>
      </div>

      <p className="text-sm text-muted-foreground">
        Identifica <strong>todos os documentos</strong> na página do processo no eproc. 
        Para documentos de <strong>RPV, Precatório e Alvará</strong>, lança automaticamente no financeiro pendente de conferência.
      </p>

      <div className="flex items-center gap-3">
        <a
          href={bookmarkletUrl}
          onClick={(e) => e.preventDefault()}
          onDragStart={() => {}}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-accent-foreground text-sm font-semibold cursor-grab active:cursor-grabbing shadow-md hover:opacity-90 transition-opacity select-none"
          title="Arraste para a barra de favoritos"
        >
          <FileSearch className="w-4 h-4" /> 📄 Capturar Documentos
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
              <span>Acesse a <strong>página do processo</strong> no eproc e resolva o CAPTCHA.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">3</span>
              <span>Clique no favorito <strong>"📄 Capturar Documentos"</strong>.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">4</span>
              <span>Na janela que abrir, <strong>selecione os documentos</strong> que deseja processar.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">5</span>
              <span className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                RPVs, Precatórios e Alvarás são lançados automaticamente no financeiro para conferência.
              </span>
            </li>
          </ol>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <p className="text-xs text-muted-foreground w-full">Acesse o tribunal:</p>
        <a href="https://eproc.trf4.jus.br/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
          <ExternalLink className="w-3 h-3" /> eProc TRF4
        </a>
        <a href="https://eproc.tjrs.jus.br/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
          <ExternalLink className="w-3 h-3" /> eProc TJRS
        </a>
      </div>
    </div>
  );
};

export default DocumentCaptureBookmarklet;
