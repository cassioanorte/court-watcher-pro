import { useState } from "react";
import { Download, ExternalLink, CheckCircle, Copy, Users, Scale } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function getMassImportBookmarkletCode(tenantId: string): string {
  const code = `
(function(){
  var rows=document.querySelectorAll('table tr');
  var procs=[];
  var cnj=/\\d{7}-\\d{2}\\.\\d{4}\\.\\d\\.\\d{2}\\.\\d{4}/;
  for(var i=0;i<rows.length;i++){
    var cells=rows[i].querySelectorAll('td');
    if(cells.length<5) continue;
    var numEl=cells[0];
    var link=numEl.querySelector('a');
    var numText=(link?link.textContent:numEl.textContent)||'';
    numText=numText.replace(/\\s/g,'').trim();
    if(!cnj.test(numText)) continue;
    var num=numText.match(cnj)[0];
    var autor=(cells[4]?cells[4].textContent:'').trim();
    var reu=(cells[5]?cells[5].textContent:'').trim();
    var classe=(cells[6]?cells[6].textContent:'').trim();
    var assunto=(cells[7]?cells[7].textContent:'').trim();
    procs.push({process_number:num,author:autor||null,defendant:reu||null,classe:classe||null,subject:assunto||null});
  }
  if(procs.length===0){
    var text=document.body.innerText;
    var re=/\\d{7}-\\d{2}\\.\\d{4}\\.\\d\\.\\d{2}\\.\\d{4}/g;
    var m;
    var seen={};
    while((m=re.exec(text))!==null){
      if(!seen[m[0]]){seen[m[0]]=1;procs.push({process_number:m[0],author:null,defendant:null,classe:null,subject:null});}
    }
  }
  if(procs.length===0){alert('Nenhum processo encontrado na página.');return;}
  var tid='${tenantId}';
  fetch('${SUPABASE_URL}/functions/v1/mass-import-processes',{
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':'${SUPABASE_KEY}'},
    body:JSON.stringify({processes:procs,tenant_id:tid})
  }).then(function(r){return r.json()}).then(function(d){
    if(d.success){
      alert('✅ Importação concluída!\\n\\n📋 Encontrados: '+d.total_found+'\\n✅ Novos: '+d.cases_created+'\\n⏭️ Já existentes: '+d.cases_skipped);
    }else{
      alert('❌ Erro: '+(d.error||'Falha desconhecida'));
    }
  }).catch(function(e){
    alert('❌ Erro de conexão: '+e.message);
  });
})();
  `.replace(/\n/g, "").replace(/\s+/g, " ").trim();
  return `javascript:${encodeURIComponent(code)}`;
}

const MassImportBookmarklet = () => {
  const { toast } = useToast();
  const { tenantId } = useAuth();
  const [showInstructions, setShowInstructions] = useState(false);

  if (!tenantId) return null;

  const bookmarkletUrl = getMassImportBookmarkletCode(tenantId);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(bookmarkletUrl);
    toast({ title: "Copiado!", description: "Cole na barra de favoritos como URL de um novo favorito." });
  };

  return (
    <div className="bg-card rounded-lg border p-5 shadow-card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Download className="w-4 h-4 text-accent" /> Importação em Massa (Bookmarklet)
        </h2>
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="text-xs text-accent hover:underline"
        >
          {showInstructions ? "Ocultar instruções" : "Como usar?"}
        </button>
      </div>

      <p className="text-sm text-muted-foreground">
        Importe <strong>todos os seus processos</strong> de uma vez a partir do tribunal.
        Faça login no eproc, pesquise pela sua OAB e clique no bookmarklet para importar automaticamente.
      </p>

      <div className="flex items-center gap-3">
        <a
          href={bookmarkletUrl}
          onClick={(e) => e.preventDefault()}
          onDragStart={() => {}}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-accent-foreground text-sm font-semibold cursor-grab active:cursor-grabbing shadow-md hover:opacity-90 transition-opacity select-none"
          title="Arraste para a barra de favoritos"
        >
          <Download className="w-4 h-4" /> 📥 Importar Processos em Massa
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
              <span>Acesse o <strong>eproc</strong> do tribunal e <strong>faça login</strong>.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">3</span>
              <span>Pesquise pela sua <strong>OAB</strong> para listar todos os seus processos.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">4</span>
              <span>Clique no favorito <strong>"📥 Importar Processos em Massa"</strong>.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">5</span>
              <span className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-accent shrink-0" />
                Pronto! Processos importados. Acesse a página de Processos para revisar e vincular os clientes.
              </span>
            </li>
          </ol>

          <div className="pt-2 border-t border-border space-y-2">
            <div className="flex items-start gap-2">
              <Users className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                <strong>Vinculação de clientes:</strong> Após importar, acesse cada processo na lista e selecione qual parte é seu cliente. O sistema criará o cadastro automaticamente.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Scale className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                <strong>Sem duplicatas:</strong> Processos já cadastrados são automaticamente ignorados.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <p className="text-xs text-muted-foreground w-full">Acesse o tribunal para começar:</p>
        <a href="https://eproc.trf4.jus.br/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
          <ExternalLink className="w-3 h-3" /> eProc TRF4
        </a>
        <a href="https://eproc.tjrs.jus.br/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
          <ExternalLink className="w-3 h-3" /> eProc TJRS
        </a>
        <a href="https://consulta.trf4.jus.br/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
          <ExternalLink className="w-3 h-3" /> Consulta TRF4
        </a>
      </div>
    </div>
  );
};

export default MassImportBookmarklet;
