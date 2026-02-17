import { useState } from "react";
import { Copy, CheckCircle, MousePointerClick } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function getSelectionBookmarkletCode(): string {
  // Use the preview URL to open a popup that handles extraction
  // This bypasses CSP restrictions on tribunal websites
  const appUrl = window.location.origin;
  const code = `
(function(){
  var sel=window.getSelection().toString().trim();
  if(!sel||sel.length<10){alert('⚠️ Selecione o texto com os dados do cliente antes de clicar no bookmarklet.\\n\\nDica: Selecione o trecho que contém CPF, RG, endereço, etc.');return;}
  var url='${appUrl}/extrair-texto?text='+encodeURIComponent(sel);
  var w=Math.min(600,screen.width-100);
  var h=Math.min(700,screen.height-100);
  var left=(screen.width-w)/2;
  var top=(screen.height-h)/2;
  window.open(url,'_extractPopup','width='+w+',height='+h+',left='+left+',top='+top+',scrollbars=yes,resizable=yes');
})();
  `.replace(/\n/g, "").replace(/\s+/g, " ").trim();
  return `javascript:${encodeURIComponent(code)}`;
}

const ExtractDataBookmarklet = () => {
  const { toast } = useToast();
  const [showInstructions, setShowInstructions] = useState(false);
  const bookmarkletUrl = getSelectionBookmarkletCode();

  const handleCopyCode = () => {
    navigator.clipboard.writeText(bookmarkletUrl);
    toast({ title: "Copiado!", description: "Cole na barra de favoritos como URL de um novo favorito." });
  };

  return (
    <div className="bg-card rounded-lg border p-5 shadow-card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <MousePointerClick className="w-4 h-4 text-accent" /> Extração por Texto Selecionado
        </h2>
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="text-xs text-accent hover:underline"
        >
          {showInstructions ? "Ocultar instruções" : "Como usar?"}
        </button>
      </div>

      <p className="text-sm text-muted-foreground">
        <strong>Selecione o texto</strong> com os dados do cliente em qualquer página (tribunal, PDF, etc.) e clique no favorito.
        O sistema extrai CPF, RG, endereço e todos os dados de qualificação automaticamente.
      </p>

      <div className="flex items-center gap-3">
        <a
          href={bookmarkletUrl}
          onClick={(e) => e.preventDefault()}
          onDragStart={() => {}}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-accent-foreground text-sm font-semibold cursor-grab active:cursor-grabbing shadow-md hover:opacity-90 transition-opacity select-none"
          title="Arraste para a barra de favoritos"
        >
          <MousePointerClick className="w-4 h-4" /> 📋 Extrair do Texto
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
              <span>Abra o documento no <strong>tribunal ou qualquer página</strong>.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">3</span>
              <span><strong>Selecione com o mouse</strong> o trecho com os dados de qualificação do cliente.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">4</span>
              <span>Clique no favorito <strong>"📋 Extrair do Texto"</strong>.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">5</span>
              <span className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                Confira os dados extraídos e confirme para salvar no cadastro do cliente.
              </span>
            </li>
          </ol>

          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              <strong>Dados extraídos:</strong> CPF, RG, Endereço, Telefone, Email, Estado Civil, Nacionalidade, Naturalidade, 
              Nome dos pais, Data de nascimento, CNH, CTPS, PIS, Título de Eleitor, Profissão, Passaporte e Certidão de Reservista.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              <strong>Dica:</strong> Se o cliente tiver CPF cadastrado no sistema, ele será identificado automaticamente.
              Caso contrário, use o botão dentro do perfil do contato.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExtractDataBookmarklet;
