import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { RefreshCw, ExternalLink, CheckCircle, Copy, Clock, Zap, ShieldCheck, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

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

function getEprocSyncBookmarkletCode(tenantId: string, userId: string): string {
  // This bookmarklet:
  // 1. Detects which eproc we're on
  // 2. Finds all process numbers on the current page
  // 3. For each process, fetches its detail page (same-origin) to get movements
  // 4. Sends everything to our backend
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

  var cnj=/\\d{7}-\\d{2}\\.\\d{4}\\.\\d\\.\\d{2}\\.\\d{4}/g;
  var pageText=document.body.innerText;
  var matches=pageText.match(cnj)||[];
  var unique={};
  var procs=[];
  for(var i=0;i<matches.length;i++){
    if(!unique[matches[i]]){unique[matches[i]]=1;procs.push(matches[i]);}
  }

  if(procs.length===0){
    setMsg('❌ Nenhum processo encontrado','Pesquise pela sua OAB para listar processos.',100);
    $('lx-icon').textContent='❌';
    setTimeout(function(){overlay.remove()},4000);
    return;
  }

  setMsg('Processos encontrados: '+procs.length,'Buscando movimentações de cada processo...',5);

  var results=[];
  var done=0;
  var total=procs.length;
  var batchSize=3;
  var currentIdx=0;

  function parseMovs(html){
    var movs=[];
    var pat=/(\\d{2}\\/\\d{2}\\/\\d{4})\\s*(\\d{2}:\\d{2}(?::\\d{2})?)?\\s*[-–|]\\s*([^<\\n]+)/g;
    var m;
    var text=html.replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ');
    while((m=pat.exec(text))!==null){
      var ds=m[1].split('/');
      var ts=m[2]?m[2].split(':'):[0,0];
      var d=new Date(parseInt(ds[2]),parseInt(ds[1])-1,parseInt(ds[0]),parseInt(ts[0])||0,parseInt(ts[1])||0);
      if(d.getFullYear()<1990||d.getFullYear()>2030)continue;
      var title=m[3].trim().substring(0,500);
      if(title.length<3)continue;
      movs.push({title:title,date:d.toISOString(),details:null});
    }
    var rowPat=/<tr[^>]*>[\\s\\S]*?<td[^>]*>[\\s\\S]*?(\\d{2}\\/\\d{2}\\/\\d{4})[\\s\\S]*?<\\/td>[\\s\\S]*?<td[^>]*>([\\s\\S]*?)<\\/td>[\\s\\S]*?<\\/tr>/gi;
    while((m=rowPat.exec(html))!==null){
      var ds2=m[1].split('/');
      var content=m[2].replace(/<[^>]*>/g,' ').replace(/\\s+/g,' ').trim();
      if(content.length<3)continue;
      var d2=new Date(parseInt(ds2[2]),parseInt(ds2[1])-1,parseInt(ds2[0]));
      if(d2.getFullYear()<1990||d2.getFullYear()>2030)continue;
      var exists=movs.some(function(x){return x.title===content&&x.date===d2.toISOString()});
      if(!exists)movs.push({title:content,date:d2.toISOString(),details:null});
    }
    return movs;
  }

  function parseParties(html){
    var text=html.replace(/<[^>]*>/g,' ').replace(/\\s+/g,' ');
    var authorM=text.match(/(?:Autor|Requerente|Exequente|Impetrante|Reclamante)[:\\s]+([^|,;\\n]+)/i);
    var reuM=text.match(/(?:R[ée]u|Requerido|Executado|Impetrado|Reclamado)[:\\s]+([^|,;\\n]+)/i);
    var parts=[];
    if(authorM)parts.push(authorM[1].trim().substring(0,200));
    if(reuM)parts.push(reuM[1].trim().substring(0,200));
    return parts.length>0?parts.join(' | '):null;
  }

  function parseSubject(html){
    var text=html.replace(/<[^>]*>/g,' ').replace(/\\s+/g,' ');
    var m=text.match(/(?:Assunto|Classe)[:\\s]+([^|\\n]{3,100})/i);
    return m?m[1].trim():null;
  }

  function fetchProcess(num,cb){
    var base=location.origin+location.pathname.replace(/controlador\\.php.*/,'controlador.php');
    var url=base+'?acao=processo_selecionar&num_processo='+encodeURIComponent(num)+'&hash=';
    fetch(url,{credentials:'include'}).then(function(r){return r.text()}).then(function(html){
      var movs=parseMovs(html);
      var parties=parseParties(html);
      var subject=parseSubject(html);
      cb({process_number:num,parties:parties,subject:subject,movements:movs});
    }).catch(function(){
      cb({process_number:num,parties:null,subject:null,movements:[]});
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
          done++;
          var pct=Math.round((done/total)*90)+5;
          setMsg('Sincronizando... ('+done+'/'+total+')','Buscando movimentações...',pct,result.process_number+': '+result.movements.length+' mov.');
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
    setMsg('Enviando dados...','Salvando '+results.length+' processos no sistema...',95);
    var totalMovs=0;
    for(var i=0;i<results.length;i++)totalMovs+=results[i].movements.length;

    fetch('${SUPABASE_URL}/functions/v1/sync-eproc-bulk',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':'${SUPABASE_KEY}'},
      body:JSON.stringify({
        tenant_id:'${tenantId}',
        user_id:'${userId}',
        eproc_host:host,
        processes:results
      })
    }).then(function(r){return r.json()}).then(function(d){
      if(d.success){
        $('lx-icon').textContent='✅';
        setMsg('Sincronização concluída!','✅ '+d.processes_synced+' processos | '+d.movements_synced+' movimentações | '+d.cases_created+' novos',100);
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

const EprocSessionSync = () => {
  const { tenantId, user } = useAuth();
  const { toast } = useToast();
  const [showInstructions, setShowInstructions] = useState(false);
  const [recentSyncs, setRecentSyncs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    const loadSyncs = async () => {
      const { data } = await supabase
        .from("eproc_sync_logs")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(5);
      setRecentSyncs((data as SyncLog[]) || []);
      setLoading(false);
    };
    loadSyncs();
  }, [tenantId]);

  if (!tenantId || !user) return null;

  const bookmarkletUrl = getEprocSyncBookmarkletCode(tenantId, user.id);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(bookmarkletUrl);
    toast({ title: "Copiado!", description: "Cole na barra de favoritos como URL de um novo favorito." });
  };

  const lastSync = recentSyncs.length > 0 ? recentSyncs[0] : null;
  const lastSyncTime = lastSync?.completed_at || lastSync?.started_at;
  const isSessionActive = lastSync && lastSync.status === "completed" && lastSyncTime && 
    (() => {
      const syncDate = new Date(lastSyncTime);
      const now = new Date();
      // Session is "active" if synced today (before midnight)
      return syncDate.toDateString() === now.toDateString();
    })();

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
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="text-xs text-accent hover:underline"
          >
            {showInstructions ? "Ocultar" : "Como usar?"}
          </button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Faça login no eproc, pesquise pela sua OAB e clique no bookmarklet. O sistema buscará <strong>todos os processos e movimentações</strong> automaticamente, incluindo os em <strong>segredo de justiça</strong>.
      </p>

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
              <span>Acesse o <strong>eproc</strong> (TJRS ou TRF4) e <strong>faça login</strong> normalmente (resolve o CAPTCHA).</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">3</span>
              <span>Pesquise pela sua <strong>OAB</strong> para listar todos os seus processos na tela.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">4</span>
              <span>Clique no favorito <strong>"🔑 Sincronizar eproc"</strong>. O sistema buscará automaticamente as movimentações de cada processo.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">5</span>
              <span className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                Pronto! Processos e movimentações sincronizados, incluindo os em segredo de justiça.
              </span>
            </li>
          </ol>

          <div className="pt-2 border-t border-border space-y-2">
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                <strong>Segredo de justiça:</strong> Como o bookmarklet usa sua sessão autenticada no eproc, ele consegue acessar processos sigilosos que a consulta pública (DataJud) não alcança.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                <strong>Rotina diária:</strong> A sessão do eproc dura até meia-noite. Faça login uma vez por dia, clique no bookmarklet, e mantenha todos os dados atualizados (~30 segundos).
              </p>
            </div>
            <div className="flex items-start gap-2">
              <RefreshCw className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                <strong>Sem duplicatas:</strong> Processos já cadastrados são atualizados. Movimentações existentes são ignoradas automaticamente.
              </p>
            </div>
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

      <div className="flex flex-wrap gap-2 pt-1">
        <p className="text-xs text-muted-foreground w-full">Acesse o tribunal para começar:</p>
        <a href="https://eproc.tjrs.jus.br/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
          <ExternalLink className="w-3 h-3" /> eProc TJRS
        </a>
        <a href="https://eproc.jfrs.jus.br/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
          <ExternalLink className="w-3 h-3" /> eProc JFRS
        </a>
        <a href="https://eproc.jfsc.jus.br/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
          <ExternalLink className="w-3 h-3" /> eProc JFSC
        </a>
        <a href="https://eproc.jfpr.jus.br/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
          <ExternalLink className="w-3 h-3" /> eProc JFPR
        </a>
        <a href="https://eproc.trf4.jus.br/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
          <ExternalLink className="w-3 h-3" /> eProc TRF4
        </a>
      </div>
    </motion.div>
  );
};

export default EprocSessionSync;
