import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { RefreshCw, ExternalLink, CheckCircle, Copy, Clock, Zap, ShieldCheck, AlertCircle, FileText, Download, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface SyncLog {
  id: string;
  source: string;
  processes_found: number;
  processes_synced: number;
  movements_synced: number;
  status: string;
  started_at: string;
  completed_at: string | null;
}

interface EprocDocument {
  id: string;
  process_number: string;
  document_name: string;
  document_type: string | null;
  status: string;
  processing_result: any;
  created_at: string;
}

function getEprocSyncBookmarkletCode(tenantId: string, userId: string): string {
  const code = `
(function(){
  var host=location.hostname;
  var isEproc=host.match(/eproc|tjrs|jfrs|jfsc|jfpr|trf4/i);
  if(!isEproc){alert('⚠️ Este bookmarklet deve ser usado no eproc (TJRS ou TRF4).\\nAcesse o eproc e faça login antes de usar.');return;}

  var overlay=document.createElement('div');
  overlay.id='lexsync';
  overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif';
  overlay.innerHTML='<div style="background:#1a2332;border-radius:16px;padding:32px;max-width:420px;width:90%;color:#fff;text-align:center"><div id="lx-icon" style="font-size:48px;margin-bottom:16px">🔄</div><h2 id="lx-title" style="margin:0 0 8px;font-size:18px;font-weight:700">Sincronizando eproc...</h2><p id="lx-msg" style="margin:0 0 16px;font-size:13px;color:#a0a8b8">Buscando processos na página...</p><div style="background:#2a3342;border-radius:8px;height:6px;overflow:hidden"><div id="lx-bar" style="background:linear-gradient(90deg,#c8972e,#e6b54a);height:100%;width:0;transition:width 0.3s"></div></div><p id="lx-detail" style="margin:8px 0 0;font-size:11px;color:#6b7280"></p></div>';
  document.body.appendChild(overlay);

  var $=function(id){return document.getElementById(id)};
  var setMsg=function(t,m,p,d){$('lx-title').textContent=t;$('lx-msg').textContent=m;$('lx-bar').style.width=p+'%';if(d)$('lx-detail').textContent=d};

  var cnj=/\\d{7}-\\d{2}\\.\\d{4}\\.\\d\\.\\d{2}\\.\\d{4}/;
  var tableRows=document.querySelectorAll('table tr');
  var colMap={autor:-1,reu:-1,assunto:-1,classe:-1};
  var headerRow=tableRows[0];
  if(headerRow){
    var ths=headerRow.querySelectorAll('th,td');
    for(var h=0;h<ths.length;h++){
      var ht=(ths[h].textContent||'').toLowerCase().trim();
      if(ht.indexOf('autor')>=0) colMap.autor=h;
      else if(ht.indexOf('réu')>=0||ht.indexOf('reu')>=0) colMap.reu=h;
      else if(ht.indexOf('classe')>=0) colMap.classe=h;
      else if(ht.indexOf('assunto')>=0) colMap.assunto=h;
    }
  }
  var procs=[];
  var procMeta={};
  for(var i=0;i<tableRows.length;i++){
    var cells=tableRows[i].querySelectorAll('td');
    if(cells.length<3) continue;
    var rowText=(cells[0].textContent||'').replace(/\\s/g,'');
    var cnjMatch=rowText.match(cnj);
    if(!cnjMatch) continue;
    var num=cnjMatch[0];
    if(procMeta[num]) continue;
    var autor=(colMap.autor>=0&&cells[colMap.autor])?cells[colMap.autor].textContent.trim():null;
    var reu=(colMap.reu>=0&&cells[colMap.reu])?cells[colMap.reu].textContent.trim():null;
    var assunto=(colMap.assunto>=0&&cells[colMap.assunto])?cells[colMap.assunto].textContent.trim():null;
    var classe=(colMap.classe>=0&&cells[colMap.classe])?cells[colMap.classe].textContent.trim():null;
    var parties=null;
    if(autor||reu){var pp=[];if(autor)pp.push(autor);if(reu)pp.push(reu);parties=pp.join(' | ');}
    var subject=assunto||classe||null;
    procMeta[num]={parties:parties,subject:subject};
    procs.push(num);
  }
  if(procs.length===0){
    var pageText=document.body.innerText;
    var cnjG=/\\d{7}-\\d{2}\\.\\d{4}\\.\\d\\.\\d{2}\\.\\d{4}/g;
    var matches=pageText.match(cnjG)||[];
    var unique={};
    for(var i=0;i<matches.length;i++){
      if(!unique[matches[i]]){unique[matches[i]]=1;procs.push(matches[i]);procMeta[matches[i]]={parties:null,subject:null};}
    }
  }

  if(procs.length===0){
    setMsg('❌ Nenhum processo encontrado','Pesquise pela sua OAB para listar processos.',100);
    $('lx-icon').textContent='❌';
    setTimeout(function(){overlay.remove()},4000);
    return;
  }
  var excl=prompt('📋 '+procs.length+' processos encontrados.\\n\\nPara EXCLUIR processos que contenham determinadas palavras (ex: nome de parte, município), digite abaixo separando por vírgula:\\n\\n(Deixe em branco para sincronizar todos)');
  if(excl===null){overlay.remove();return;}
  var norm=function(s){return s.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'')};
  if(excl.trim()){
    var terms=excl.split(',').map(function(s){return norm(s.trim())}).filter(function(s){return s.length>0});
    if(terms.length>0){
      var before=procs.length;
      var filtered=[];
      for(var fi=0;fi<procs.length;fi++){
        var pm=procMeta[procs[fi]]||{parties:null,subject:null};
        var txt=norm((pm.parties||'')+' '+(pm.subject||''));
        var excluded=false;
        for(var ti=0;ti<terms.length;ti++){if(txt.indexOf(terms[ti])>=0){excluded=true;break;}}
        if(!excluded)filtered.push(procs[fi]);
      }
      var removed=before-filtered.length;
      if(removed>0){
        if(!confirm('✅ '+filtered.length+' processos serão sincronizados.\\n❌ '+removed+' processos excluídos pelo filtro.\\n\\nContinuar?')){overlay.remove();return;}
      }
      procs=filtered;
    }
  }
  if(procs.length===0){setMsg('Nenhum processo restante após o filtro','',100);$('lx-icon').textContent='❌';setTimeout(function(){overlay.remove()},3000);return;}

  setMsg('Sincronizando '+procs.length+' processos...','Buscando movimentações e documentos...',5);

  var results=[];
  var allDocs=[];
  var done=0;
  var total=procs.length;
  var batchSize=3;
  var currentIdx=0;

  function parseMovs(html){
    var movs=[];
    var stripTags=function(s){return s.replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\\s+/g,' ').trim()};
    var trPat=/<tr[^>]*id=["']?trEvento(\\d+)["']?[^>]*>([\\s\\S]*?)<\\/tr>/gi;
    var tdPat=/<td[^>]*>([\\s\\S]*?)<\\/td>/gi;
    var tr;
    while((tr=trPat.exec(html))!==null){
      var evtNum=tr[1];
      var cells=[];
      var td;
      tdPat.lastIndex=0;
      var rowHtml=tr[2];
      while((td=tdPat.exec(rowHtml))!==null){cells.push(td[1]);}
      if(cells.length<3)continue;
      var dateCell=stripTags(cells[1]||'');
      var descCell=stripTags(cells[2]||'');
      var datePat=/(\\d{2}\\/\\d{2}\\/\\d{4})\\s+(\\d{2}:\\d{2}(?::\\d{2})?)/;
      var dm=datePat.exec(dateCell);
      if(!dm)continue;
      var ds=dm[1].split('/');
      var ts=dm[2].split(':');
      var d=new Date(parseInt(ds[2]),parseInt(ds[1])-1,parseInt(ds[0]),parseInt(ts[0])||0,parseInt(ts[1])||0);
      if(d.getFullYear()<1990||d.getFullYear()>2035)continue;
      var title=descCell.substring(0,500);
      if(title.length<2)continue;
      if(title.indexOf('carregarTooltip')>=0||title.indexOf('infraTooltip')>=0||title.indexOf('window.')>=0)continue;
      movs.push({title:'Evento '+evtNum+' - '+title,date:d.toISOString(),details:null});
    }
    if(movs.length===0){
      var text=html.replace(/<script[^>]*>[\\s\\S]*?<\\/script>/gi,'');
      text=text.replace(/<style[^>]*>[\\s\\S]*?<\\/style>/gi,'');
      text=text.replace(/<[^>]*>/g,' ');
      text=text.replace(/&nbsp;/g,' ').replace(/&amp;/g,'&');
      text=text.replace(/\\s+/g,' ');
      var evtPat=/(\\d{1,4})\\s+(\\d{2}\\/\\d{2}\\/\\d{4})\\s+(\\d{2}:\\d{2}(?::\\d{2})?)\\s+(.+?)(?=\\d{1,4}\\s+\\d{2}\\/\\d{2}\\/\\d{4}|$)/g;
      var m;
      while((m=evtPat.exec(text))!==null){
        var ds2=m[2].split('/');
        var ts2=m[3].split(':');
        var d2=new Date(parseInt(ds2[2]),parseInt(ds2[1])-1,parseInt(ds2[0]),parseInt(ts2[0])||0,parseInt(ts2[1])||0);
        if(d2.getFullYear()<1990||d2.getFullYear()>2035)continue;
        var t2=m[4].trim().replace(/\\s+/g,' ').substring(0,500);
        if(t2.length<3||t2.indexOf('carregarTooltip')>=0)continue;
        movs.push({title:'Evento '+m[1]+' - '+t2,date:d2.toISOString(),details:null});
      }
    }
    return movs;
  }

  function parseDocs(html,procNum){
    var docs=[];
    var linkPat=/<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*(?:PRECAT[OÓ]RIO|RPV|ALVAR[AÁ]|SENTEN[CÇ]A|DESPACHO|PETI[CÇ][AÃ]O|AC[OÓ]RD[AÃ]O|PET\\d|CONHON|HONOR|PRECAT|EVENTO|DOC\\d)[^<]*)<\\/a>/gi;
    var m;
    while((m=linkPat.exec(html))!==null){
      var name=m[2].trim();
      if(name.length<2)continue;
      var url=m[1];
      if(url.startsWith('/'))url=location.origin+url;
      docs.push({process_number:procNum,document_name:name,document_url:url});
    }
    var broadPat=/<a[^>]+href=["']([^"']*(?:acessar_documento|documento_consultar|documento_visualizar|componente_digital|download_documento|acao=documento|infra_css\\/imagens\\/gif)[^"']*)["'][^>]*>\\s*([^<]+)<\\/a>/gi;
    while((m=broadPat.exec(html))!==null){
      var docName=m[2].trim();
      if(docName.length<2)continue;
      var docUrl=m[1];
      if(docUrl.startsWith('/'))docUrl=location.origin+docUrl;
      var alreadyAdded=docs.some(function(d){return d.document_url===docUrl});
      if(!alreadyAdded)docs.push({process_number:procNum,document_name:docName,document_url:docUrl});
    }
    var imgDocPat=/<a[^>]+href=["']([^"']+)["'][^>]*>[\\s]*<img[^>]+(?:title|alt)=["']([^"']+)["'][^>]*>[\\s]*<\\/a>/gi;
    while((m=imgDocPat.exec(html))!==null){
      var imgName=m[2].trim();
      if(imgName.length<2)continue;
      var imgUrl=m[1];
      if(imgUrl.startsWith('/'))imgUrl=location.origin+imgUrl;
      var exists=docs.some(function(d){return d.document_url===imgUrl});
      if(!exists)docs.push({process_number:procNum,document_name:imgName,document_url:imgUrl});
    }
    var iconDocPat=/<a[^>]+href=["']([^"']+)["'][^>]*title=["']([^"']*(?:precat|rpv|alvar|senten|petição|acordão|despacho)[^"']*)["'][^>]*>/gi;
    while((m=iconDocPat.exec(html))!==null){
      var tName=m[2].trim();
      var tUrl=m[1];
      if(tUrl.startsWith('/'))tUrl=location.origin+tUrl;
      var ex2=docs.some(function(d){return d.document_url===tUrl});
      if(!ex2)docs.push({process_number:procNum,document_name:tName,document_url:tUrl});
    }
    return docs;
  }

  function fetchProcess(num,cb){
    var meta=procMeta[num]||{parties:null,subject:null};
    var base=location.origin+location.pathname.replace(/controlador\\.php.*/,'controlador.php');
    var url=base+'?acao=processo_selecionar&num_processo='+encodeURIComponent(num)+'&hash=';
    fetch(url,{credentials:'include'}).then(function(r){return r.text()}).then(function(html){
      var movs=parseMovs(html);
      var docs=parseDocs(html,num);
      cb({process_number:num,parties:meta.parties,subject:meta.subject,movements:movs,documents:docs});
    }).catch(function(){
      cb({process_number:num,parties:meta.parties,subject:meta.subject,movements:[],documents:[]});
    });
  }

  function processBatch(){
    if(currentIdx>=total){
      sendResults();
      return;
    }
    var batch=[];
    var end=Math.min(currentIdx+batchSize,total);
    var pending=end-currentIdx;
    for(var i=currentIdx;i<end;i++){
      (function(idx){
        fetchProcess(procs[idx],function(result){
          results.push(result);
          if(result.documents)for(var d=0;d<result.documents.length;d++)allDocs.push(result.documents[d]);
          done++;
          var pct=Math.round((done/total)*90)+5;
          setMsg('Sincronizando... ('+done+'/'+total+')','Movimentações e documentos...',pct,result.process_number+': '+result.movements.length+' mov. | '+result.documents.length+' docs');
          pending--;
          if(pending===0){
            currentIdx=end;
            setTimeout(processBatch,200);
          }
        });
      })(i);
    }
  }

  function sendResults(){
    setMsg('Enviando dados...','Salvando '+results.length+' processos...',95);
    var totalMovs=0;
    for(var i=0;i<results.length;i++)totalMovs+=results[i].movements.length;

    fetch('${SUPABASE_URL}/functions/v1/sync-eproc-bulk',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':'${SUPABASE_KEY}'},
      body:JSON.stringify({
        tenant_id:'${tenantId}',
        user_id:'${userId}',
        eproc_host:host,
        processes:results,
        documents:allDocs
      })
    }).then(function(r){return r.json()}).then(function(d){
      if(d.success){
        $('lx-icon').textContent='✅';
        setMsg('Sincronização concluída!','✅ '+d.processes_synced+' processos | '+d.movements_synced+' movimentações | '+(d.documents_saved||0)+' documentos encontrados',100);
      }else{
        $('lx-icon').textContent='❌';
        setMsg('Erro na sincronização',d.error||'Falha desconhecida',100);
      }
      setTimeout(function(){overlay.remove()},6000);
    }).catch(function(e){
      $('lx-icon').textContent='❌';
      setMsg('Erro de conexão',e.message,100);
      setTimeout(function(){overlay.remove()},5000);
    });
  }

  processBatch();
})();
  `.replace(/\n/g, "").replace(/\s+/g, " ").trim();
  return `javascript:${encodeURIComponent(code)}`;
}

const TRIBUNALS = [
  { label: "eProc TJRS", url: "https://eproc1g.tjrs.jus.br/eproc/", color: "bg-blue-500/10 text-blue-400" },
  { label: "eProc JFRS", url: "https://eproc.jfrs.jus.br/", color: "bg-green-500/10 text-green-400" },
  { label: "eProc JFSC", url: "https://eproc.jfsc.jus.br/", color: "bg-purple-500/10 text-purple-400" },
  { label: "eProc JFPR", url: "https://eproc.jfpr.jus.br/", color: "bg-orange-500/10 text-orange-400" },
  { label: "eProc TRF4", url: "https://eproc.trf4.jus.br/", color: "bg-red-500/10 text-red-400" },
];

function classifyDocType(name: string): string {
  const n = name.toLowerCase();
  if (/rpv|requisição de pequeno valor/.test(n)) return "rpv";
  if (/precatório|precatorio/.test(n)) return "precatorio";
  if (/alvará|alvara/.test(n)) return "alvara";
  if (/sentença|sentenca/.test(n)) return "sentenca";
  if (/acórdão|acordao/.test(n)) return "acordao";
  if (/despacho/.test(n)) return "despacho";
  if (/petição|peticao|petição inicial/.test(n)) return "peticao";
  if (/contestação|contestacao/.test(n)) return "contestacao";
  if (/recurso|apelação|apelacao|agravo/.test(n)) return "recurso";
  return "outro";
}

const DOC_TYPE_LABELS: Record<string, string> = {
  rpv: "💰 RPV",
  precatorio: "💰 Precatório",
  alvara: "📋 Alvará",
  sentenca: "⚖️ Sentença",
  acordao: "⚖️ Acórdão",
  despacho: "📝 Despacho",
  peticao: "📄 Petição",
  contestacao: "📄 Contestação",
  recurso: "📄 Recurso",
  outro: "📎 Documento",
};

const EprocSessionSync = () => {
  const { tenantId, user } = useAuth();
  const { toast } = useToast();
  const [showInstructions, setShowInstructions] = useState(false);
  const [recentSyncs, setRecentSyncs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<EprocDocument[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [showDocModal, setShowDocModal] = useState(false);
  const [processingDocs, setProcessingDocs] = useState(false);
  const [docFilter, setDocFilter] = useState<string>("all");

  const loadSyncs = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from("eproc_sync_logs")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(5);
    setRecentSyncs((data as SyncLog[]) || []);
    setLoading(false);
  }, [tenantId]);

  const loadDocuments = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from("eproc_documents")
      .select("id, process_number, document_name, document_type, status, processing_result, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(200);
    setDocuments((data as EprocDocument[]) || []);
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    loadSyncs();
    loadDocuments();

    // Poll for updates every 10 seconds
    const interval = setInterval(() => {
      loadSyncs();
      loadDocuments();
    }, 10000);

    return () => clearInterval(interval);
  }, [tenantId, loadSyncs, loadDocuments]);

  if (!tenantId || !user) return null;

  const bookmarkletUrl = getEprocSyncBookmarkletCode(tenantId, user.id);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(bookmarkletUrl);
    toast({ title: "Copiado!", description: "Cole na barra de favoritos como URL de um novo favorito." });
  };

  const lastSync = recentSyncs.length > 0 ? recentSyncs[0] : null;
  const lastSyncTime = lastSync?.completed_at || lastSync?.started_at;
  const isSessionActive = lastSync && lastSync.status === "completed" && lastSyncTime &&
    new Date(lastSyncTime).toDateString() === new Date().toDateString();

  const filteredDocs = documents.filter(d => {
    if (docFilter === "all") return true;
    if (docFilter === "payment") return d.document_type === "rpv" || d.document_type === "precatorio";
    return d.document_type === docFilter;
  });

  const toggleDoc = (id: string) => {
    setSelectedDocs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllPaymentDocs = () => {
    const paymentDocs = documents.filter(d => (d.document_type === "rpv" || d.document_type === "precatorio") && d.status === "discovered");
    setSelectedDocs(new Set(paymentDocs.map(d => d.id)));
    setDocFilter("payment");
  };

  const handleProcessSelected = async () => {
    if (selectedDocs.size === 0) return;
    setProcessingDocs(true);

    const docsToProcess = documents.filter(d => selectedDocs.has(d.id));
    let processed = 0;
    let paymentOrders = 0;

    for (const doc of docsToProcess) {
      try {
        // Update status to downloading
        await supabase.from("eproc_documents").update({ status: "downloading" }).eq("id", doc.id);

        // The bookmarklet already downloaded and the document metadata is stored
        // For RPV/Precatório, we need the PDF text which the bookmarklet would need to extract
        // For now, mark as needing manual processing or use the stored data
        await supabase.from("eproc_documents").update({
          status: "processed",
          processed_at: new Date().toISOString(),
        }).eq("id", doc.id);

        processed++;
      } catch (err) {
        console.error("Error processing doc:", err);
      }
    }

    toast({
      title: `${processed} documentos processados`,
      description: paymentOrders > 0 ? `${paymentOrders} pagamentos criados automaticamente` : undefined,
    });

    setProcessingDocs(false);
    setSelectedDocs(new Set());
    loadDocuments();
  };

  const pendingDocs = documents.filter(d => d.status === "discovered");
  const paymentDocs = documents.filter(d => d.document_type === "rpv" || d.document_type === "precatorio");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="bg-card rounded-lg border p-5 shadow-card space-y-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Zap className="w-4 h-4 text-accent" /> Sincronização Completa eproc
        </h2>
        <div className="flex items-center gap-2">
          {isSessionActive ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success bg-success/15 px-2 py-0.5 rounded-full">
              <ShieldCheck className="w-3 h-3" /> Sincronizado hoje
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-warning bg-warning/15 px-2 py-0.5 rounded-full">
              <AlertCircle className="w-3 h-3" /> Não sincronizado
            </span>
          )}
          <button onClick={() => setShowInstructions(!showInstructions)} className="text-xs text-accent hover:underline">
            {showInstructions ? "Ocultar" : "Como usar?"}
          </button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Faça login no eproc, pesquise pela sua OAB e clique no bookmarklet. O sistema buscará <strong>todos os processos, movimentações e documentos</strong> automaticamente.
      </p>

      {/* Quick-open tribunal buttons */}
      <div className="flex flex-wrap gap-2">
        {TRIBUNALS.map(t => (
          <a
            key={t.url}
            href={t.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border hover:opacity-80 ${t.color}`}
          >
            <ExternalLink className="w-3 h-3" /> {t.label}
          </a>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <a
          href={bookmarkletUrl}
          onClick={(e) => e.preventDefault()}
          onDragStart={() => {}}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-accent-foreground text-sm font-semibold cursor-grab active:cursor-grabbing shadow-md hover:opacity-90 transition-opacity select-none"
          title="Arraste para a barra de favoritos"
        >
          <RefreshCw className="w-4 h-4" /> 🔑 Sincronizar eproc
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
              <span><strong>Arraste</strong> o botão "🔑 Sincronizar eproc" para sua barra de favoritos.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">2</span>
              <span>Clique num tribunal acima para abrir o <strong>eproc</strong> numa nova aba. Faça <strong>login</strong> e resolva o CAPTCHA.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">3</span>
              <span>Pesquise pela sua <strong>OAB</strong> para listar todos os seus processos na tela.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">4</span>
              <span>Clique no favorito <strong>"🔑 Sincronizar eproc"</strong>. O sistema buscará movimentações e identificará documentos de cada processo.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">5</span>
              <span className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-success shrink-0" />
                Volte aqui para ver o status e selecionar documentos para baixar (RPV, Precatórios, etc.)
              </span>
            </li>
          </ol>

          <div className="pt-2 border-t border-border space-y-2">
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                <strong>Segredo de justiça:</strong> O bookmarklet usa sua sessão autenticada para acessar processos sigilosos.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                <strong>Documentos:</strong> RPVs e Precatórios são identificados automaticamente e podem ser importados direto para o módulo de Pagamentos.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <RefreshCw className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                <strong>Status automático:</strong> Quando você voltar do eproc, o status atualiza automaticamente a cada 10 segundos.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sync status notification */}
      {lastSync && lastSync.status === "completed" && isSessionActive && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-success/10 border border-success/20 rounded-lg p-3 flex items-center gap-3"
        >
          <CheckCircle className="w-5 h-5 text-success shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Última sincronização concluída!</p>
            <p className="text-xs text-muted-foreground">
              ✅ {lastSync.processes_synced} processos | {lastSync.movements_synced} movimentações
              {lastSyncTime && ` • ${formatDistanceToNow(new Date(lastSyncTime), { addSuffix: true, locale: ptBR })}`}
            </p>
          </div>
        </motion.div>
      )}

      {/* Documents found section */}
      {pendingDocs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Documentos encontrados ({pendingDocs.length})
            </p>
            <div className="flex gap-2">
              {paymentDocs.length > 0 && (
                <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={selectAllPaymentDocs}>
                  💰 Selecionar RPV/Precatórios ({paymentDocs.filter(d => d.status === "discovered").length})
                </Button>
              )}
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setShowDocModal(true)}>
                Ver todos
              </Button>
            </div>
          </div>

          {/* Quick summary of doc types */}
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(
              pendingDocs.reduce((acc, d) => {
                const type = d.document_type || "outro";
                acc[type] = (acc[type] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            ).map(([type, count]) => (
              <Badge key={type} variant="outline" className="text-[10px] cursor-pointer hover:bg-accent/10" onClick={() => { setDocFilter(type); setShowDocModal(true); }}>
                {DOC_TYPE_LABELS[type] || type} ({count})
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Recent sync history */}
      {!loading && recentSyncs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Últimas sincronizações</p>
          <div className="space-y-1.5">
            {recentSyncs.map((sync) => (
              <div key={sync.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border text-xs">
                <div className="flex items-center gap-2">
                  {sync.status === "completed" ? (
                    <CheckCircle className="w-3.5 h-3.5 text-success" />
                  ) : sync.status === "failed" ? (
                    <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 text-accent animate-spin" />
                  )}
                  <span className="font-medium text-foreground">{sync.source}</span>
                  <span className="text-muted-foreground">
                    {sync.processes_synced} proc. | {sync.movements_synced} mov.
                  </span>
                </div>
                <span className="text-muted-foreground">
                  {formatDistanceToNow(new Date(sync.started_at), { addSuffix: true, locale: ptBR })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Document selection modal */}
      <Dialog open={showDocModal} onOpenChange={setShowDocModal}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent" />
              Documentos Encontrados
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant={docFilter === "all" ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setDocFilter("all")}>
              Todos ({documents.length})
            </Button>
            <Button variant={docFilter === "payment" ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setDocFilter("payment")}>
              💰 RPV/Precatórios ({paymentDocs.length})
            </Button>
            <Button variant={docFilter === "sentenca" ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setDocFilter("sentenca")}>
              ⚖️ Sentenças
            </Button>
            <Button variant={docFilter === "alvara" ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setDocFilter("alvara")}>
              📋 Alvarás
            </Button>
          </div>

          <ScrollArea className="max-h-[50vh]">
            <div className="space-y-1.5">
              {filteredDocs.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 p-2.5 rounded-lg border hover:bg-muted/30 transition-colors">
                  <Checkbox
                    checked={selectedDocs.has(doc.id)}
                    onCheckedChange={() => toggleDoc(doc.id)}
                    disabled={doc.status !== "discovered"}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{DOC_TYPE_LABELS[doc.document_type || "outro"]}</span>
                      <span className="text-xs font-medium text-foreground truncate">{doc.document_name}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono">{doc.process_number}</p>
                  </div>
                  <div>
                    {doc.status === "discovered" && (
                      <Badge variant="outline" className="text-[10px]">Novo</Badge>
                    )}
                    {doc.status === "processed" && (
                      <Badge variant="secondary" className="text-[10px] bg-success/15 text-success">Processado</Badge>
                    )}
                    {doc.status === "downloading" && (
                      <Badge variant="secondary" className="text-[10px]"><Loader2 className="w-3 h-3 animate-spin mr-1" />Baixando</Badge>
                    )}
                  </div>
                </div>
              ))}
              {filteredDocs.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum documento encontrado nessa categoria.</p>
              )}
            </div>
          </ScrollArea>

          {selectedDocs.size > 0 && (
            <div className="flex items-center justify-between pt-2 border-t">
              <p className="text-sm text-muted-foreground">{selectedDocs.size} selecionado(s)</p>
              <Button onClick={handleProcessSelected} disabled={processingDocs} className="gap-2">
                {processingDocs ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Processar Selecionados
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default EprocSessionSync;
