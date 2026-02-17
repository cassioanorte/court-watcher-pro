import { useState } from "react";
import { Copy, CheckCircle, Sparkles, MousePointerClick } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function getSelectionBookmarkletCode(): string {
  const code = `
(function(){
  var ENDPOINT='${SUPABASE_URL}/functions/v1/extract-selected-text';
  var APIKEY='${SUPABASE_KEY}';
  var sel=window.getSelection().toString().trim();
  if(!sel||sel.length<10){alert('⚠️ Selecione o texto com os dados do cliente antes de clicar no bookmarklet.\\n\\nDica: Selecione o trecho que contém CPF, RG, endereço, etc.');return;}

  function showStatus(msg,color){
    var d=document.getElementById('_ext_status');
    if(d)d.remove();
    d=document.createElement('div');
    d.id='_ext_status';
    d.style.cssText='position:fixed;top:20px;right:20px;z-index:999999;background:#1a2332;color:#fff;padding:16px 24px;border-radius:12px;font-family:system-ui;font-size:14px;box-shadow:0 8px 32px rgba(0,0,0,0.3);max-width:480px;line-height:1.5;';
    d.innerHTML=msg;
    document.body.appendChild(d);
    return d;
  }
  function hideStatus(){var d=document.getElementById('_ext_status');if(d)d.remove();}

  showStatus('<div style="display:flex;align-items:center;gap:8px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8972e" stroke-width="2" style="animation:spin 1s linear infinite;flex-shrink:0"><style>@keyframes spin{to{transform:rotate(360deg)}}</style><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Extraindo dados do texto selecionado...</div>');

  fetch(ENDPOINT,{
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':APIKEY},
    body:JSON.stringify({selected_text:sel,preview_only:true})
  }).then(function(r){return r.json()}).then(function(d){
    if(!d.success){hideStatus();alert('⚠️ '+(d.error||'Nenhum dado encontrado.'));return;}
    var labels={cpf:'CPF',rg:'RG',address:'Endereço',phone:'Telefone',email:'Email',civil_status:'Estado Civil',nacionalidade:'Nacionalidade',naturalidade:'Naturalidade',nome_mae:'Nome da Mãe',nome_pai:'Nome do Pai',birth_date:'Nascimento',cnh:'CNH',ctps:'CTPS',pis:'PIS',titulo_eleitor:'Título Eleitor',atividade_economica:'Profissão',certidao_reservista:'Reservista',passaporte:'Passaporte'};
    var html='<div style="margin-bottom:12px;font-weight:bold;color:#c8972e">📋 Dados encontrados ('+d.count+'):</div>';
    for(var k in d.fields){html+='<div style="margin:4px 0"><span style="color:#94a3b8;font-size:12px">'+(labels[k]||k)+':</span> <span style="color:#fff">'+d.fields[k]+'</span></div>';}
    
    if(d.identified_contact){
      html+='<div style="margin-top:12px;padding-top:12px;border-top:1px solid #334155"><span style="color:#22c55e">✓ Cliente identificado:</span> <strong>'+d.identified_contact.name+'</strong></div>';
      html+='<div style="margin-top:12px;display:flex;gap:8px"><button id="_ext_save" style="background:#c8972e;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600">✅ Salvar dados</button><button id="_ext_cancel" style="background:#334155;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px">Cancelar</button></div>';
      showStatus(html);
      document.getElementById('_ext_cancel').onclick=hideStatus;
      document.getElementById('_ext_save').onclick=function(){
        showStatus('<div style="display:flex;align-items:center;gap:8px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8972e" stroke-width="2" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Salvando...</div>');
        fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','apikey':APIKEY},body:JSON.stringify({selected_text:sel,contact_user_id:d.identified_contact.user_id})}).then(function(r){return r.json()}).then(function(r2){
          hideStatus();
          if(r2.success&&r2.updated>0){alert('✅ '+r2.client_name+'\\n\\n'+r2.updated+' campo(s) atualizado(s)!');}
          else if(r2.updated===0){alert('ℹ️ Todos os campos já estavam preenchidos.');}
          else{alert('⚠️ '+(r2.error||'Erro ao salvar.'));}
        }).catch(function(e){hideStatus();alert('❌ Erro: '+e.message);});
      };
    }else{
      html+='<div style="margin-top:12px;padding-top:12px;border-top:1px solid #334155;color:#94a3b8;font-size:12px">Para salvar, abra o contato no sistema e use o botão "Extrair do texto selecionado".</div>';
      html+='<div style="margin-top:8px"><button id="_ext_close" style="background:#334155;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px">Fechar</button></div>';
      showStatus(html);
      document.getElementById('_ext_close').onclick=hideStatus;
    }
  }).catch(function(e){hideStatus();alert('❌ Erro: '+e.message);});
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
