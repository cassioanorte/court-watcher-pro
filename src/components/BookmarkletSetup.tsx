import { useState } from "react";
import { Bookmark, ExternalLink, CheckCircle, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function getBookmarkletCode(): string {
  // Minified bookmarklet that captures page HTML and sends to our edge function
  const code = `
(function(){
  var html=document.documentElement.outerHTML;
  var url=window.location.href;
  fetch('${SUPABASE_URL}/functions/v1/capture-movements',{
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':'${SUPABASE_KEY}'},
    body:JSON.stringify({html:html,source_url:url})
  }).then(function(r){return r.json()}).then(function(d){
    if(d.success){
      alert('✅ '+d.total_parsed+' movimentações encontradas! ('+d.new_movements+' novas) - Processo: '+d.process_number);
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

const BookmarkletSetup = () => {
  const { toast } = useToast();
  const [showInstructions, setShowInstructions] = useState(false);
  const bookmarkletUrl = getBookmarkletCode();

  const handleCopyCode = () => {
    navigator.clipboard.writeText(bookmarkletUrl);
    toast({ title: "Copiado!", description: "Cole na barra de favoritos como URL de um novo favorito." });
  };

  return (
    <div className="bg-card rounded-lg border p-5 shadow-card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-accent" /> Captura de Movimentações (Bookmarklet)
        </h2>
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="text-xs text-accent hover:underline"
        >
          {showInstructions ? "Ocultar instruções" : "Como usar?"}
        </button>
      </div>

      <p className="text-sm text-muted-foreground">
        Arraste o botão abaixo para sua <strong>barra de favoritos</strong>. Ao acessar a página de um processo no tribunal, 
        resolva o CAPTCHA e clique no favorito para capturar as movimentações automaticamente.
      </p>

      <div className="flex items-center gap-3">
        <a
          href={bookmarkletUrl}
          onClick={(e) => e.preventDefault()}
          onDragStart={() => {}}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-accent-foreground text-sm font-semibold cursor-grab active:cursor-grabbing shadow-md hover:opacity-90 transition-opacity select-none"
          title="Arraste para a barra de favoritos"
        >
          <Bookmark className="w-4 h-4" /> ⚖️ Capturar Movimentações
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
              <span><strong>Arraste</strong> o botão dourado acima para sua barra de favoritos do navegador. Se não conseguir arrastar, clique em "Copiar código" e crie um favorito manualmente colando como URL.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">2</span>
              <span>Acesse a página do processo no tribunal (TRF4, TJRS, etc.) e <strong>resolva o CAPTCHA</strong> normalmente.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">3</span>
              <span>Quando a página com as movimentações estiver visível, clique no favorito <strong>"⚖️ Capturar Movimentações"</strong>.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">4</span>
              <span className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-success shrink-0" />
                Pronto! As movimentações serão importadas automaticamente. Você verá um alerta com o resultado.
              </span>
            </li>
          </ol>

          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              <strong>Dica:</strong> O sistema identifica automaticamente o número do processo na página e associa às movimentações corretas. 
              Funciona com TRF4, TJRS e qualquer tribunal que exiba as movimentações na página.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <p className="text-xs text-muted-foreground w-full">Links rápidos dos tribunais:</p>
        <a href="https://eproc.trf4.jus.br/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
          <ExternalLink className="w-3 h-3" /> eProc TRF4
        </a>
        <a href="https://www.tjrs.jus.br/novo/busca/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
          <ExternalLink className="w-3 h-3" /> TJRS
        </a>
        <a href="https://consulta.trf4.jus.br/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
          <ExternalLink className="w-3 h-3" /> Consulta TRF4
        </a>
      </div>
    </div>
  );
};

export default BookmarkletSetup;
