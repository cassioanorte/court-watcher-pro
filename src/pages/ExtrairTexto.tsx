import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Loader2, AlertTriangle, Search, UserCheck } from "lucide-react";

const FIELD_LABELS: Record<string, string> = {
  cpf: "CPF", rg: "RG", address: "Endereço", phone: "Telefone", email: "Email",
  civil_status: "Estado Civil", nacionalidade: "Nacionalidade", naturalidade: "Naturalidade",
  nome_mae: "Nome da Mãe", nome_pai: "Nome do Pai", birth_date: "Nascimento",
  cnh: "CNH", ctps: "CTPS", pis: "PIS", titulo_eleitor: "Título Eleitor",
  atividade_economica: "Profissão", certidao_reservista: "Reservista", passaporte: "Passaporte",
};

const ExtrairTexto = () => {
  const [searchParams] = useSearchParams();
  const text = searchParams.get("text") || "";
  const [status, setStatus] = useState<"loading" | "preview" | "saving" | "saved" | "error">("loading");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [identifiedContact, setIdentifiedContact] = useState<{ user_id: string; name: string } | null>(null);
  const [error, setError] = useState("");
  const [savedCount, setSavedCount] = useState(0);
  const [clientName, setClientName] = useState("");

  // Search contacts state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ user_id: string; full_name: string; cpf: string | null }[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedContact, setSelectedContact] = useState<{ user_id: string; name: string } | null>(null);

  useEffect(() => {
    if (!text || text.length < 10) {
      setStatus("error");
      setError("Texto muito curto ou ausente. Selecione o texto antes de clicar no bookmarklet.");
      return;
    }
    extract();
  }, []);

  const extract = async () => {
    setStatus("loading");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("extract-selected-text", {
        body: { selected_text: text, preview_only: true },
      });
      if (fnError || !data?.success) {
        setStatus("error");
        setError(data?.error || fnError?.message || "Nenhum dado encontrado no texto selecionado.");
        return;
      }
      setFields(data.fields || {});
      if (data.identified_contact) {
        setIdentifiedContact(data.identified_contact);
        setSelectedContact(data.identified_contact);
      }
      setStatus("preview");
    } catch (e: any) {
      setStatus("error");
      setError(e.message || "Erro ao processar.");
    }
  };

  const handleSearch = async () => {
    if (searchQuery.trim().length < 2) return;
    setSearching(true);
    try {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, cpf")
        .ilike("full_name", `%${searchQuery.trim()}%`)
        .limit(10);
      setSearchResults(data || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSave = async () => {
    const contact = selectedContact || identifiedContact;
    if (!contact) return;
    setStatus("saving");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("extract-selected-text", {
        body: { selected_text: text, contact_user_id: contact.user_id },
      });
      if (fnError || !data?.success) {
        setStatus("error");
        setError(data?.error || fnError?.message || "Erro ao salvar.");
        return;
      }
      setSavedCount(data.updated || 0);
      setClientName(data.client_name || contact.name);
      setStatus("saved");
    } catch (e: any) {
      setStatus("error");
      setError(e.message || "Erro ao salvar.");
    }
  };

  const activeContact = selectedContact || identifiedContact;

  return (
    <div className="min-h-screen bg-background p-6 font-sans">
      <div className="max-w-lg mx-auto space-y-5">
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
          📋 Extração de Dados
        </h1>

        {status === "loading" && (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /> Analisando texto selecionado...
          </div>
        )}

        {status === "error" && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
              <AlertTriangle className="w-4 h-4" /> Erro
            </div>
            <p className="text-sm text-destructive/80">{error}</p>
            <button onClick={() => window.close()} className="mt-2 px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm hover:bg-muted/80">
              Fechar
            </button>
          </div>
        )}

        {status === "preview" && (
          <>
            <p className="text-sm text-muted-foreground">
              {Object.keys(fields).length} campo(s) encontrado(s):
            </p>
            <div className="bg-card border rounded-lg divide-y divide-border">
              {Object.entries(fields).map(([key, value]) => (
                <div key={key} className="flex justify-between px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">{FIELD_LABELS[key] || key}</span>
                  <span className="font-medium text-foreground text-right max-w-[60%]">{value}</span>
                </div>
              ))}
            </div>

            {/* Contact selection */}
            {activeContact ? (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-center justify-between">
                <p className="text-sm">
                  <span className="text-primary font-semibold">✓ Cliente:</span>{" "}
                  <strong className="text-foreground">{activeContact.name}</strong>
                </p>
                <button
                  onClick={() => { setSelectedContact(null); setIdentifiedContact(null); }}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Alterar
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Selecione o contato para salvar:</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="Buscar por nome..."
                    className="flex-1 px-3 py-2 rounded-lg border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    onClick={handleSearch}
                    disabled={searching || searchQuery.trim().length < 2}
                    className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </button>
                </div>
                {searchResults.length > 0 && (
                  <div className="bg-card border rounded-lg divide-y divide-border max-h-48 overflow-auto">
                    {searchResults.map((c) => (
                      <button
                        key={c.user_id}
                        onClick={() => {
                          setSelectedContact({ user_id: c.user_id, name: c.full_name });
                          setSearchResults([]);
                          setSearchQuery("");
                        }}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors text-left"
                      >
                        <span className="font-medium text-foreground">{c.full_name}</span>
                        {c.cpf && <span className="text-xs text-muted-foreground">{c.cpf}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.length === 0 && searchQuery.length >= 2 && !searching && (
                  <p className="text-xs text-muted-foreground">Nenhum contato encontrado. Tente outro nome.</p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={!activeContact}
                className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <UserCheck className="w-4 h-4" /> Salvar dados no cadastro
              </button>
              <button onClick={() => window.close()} className="px-4 py-2.5 rounded-lg bg-muted text-muted-foreground text-sm hover:bg-muted/80">
                Fechar
              </button>
            </div>
          </>
        )}

        {status === "saving" && (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /> Salvando dados...
          </div>
        )}

        {status === "saved" && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-5 space-y-3 text-center">
            <CheckCircle className="w-10 h-10 text-primary mx-auto" />
            <p className="font-semibold text-foreground">{clientName}</p>
            <p className="text-sm text-muted-foreground">
              {savedCount > 0 ? `${savedCount} campo(s) atualizado(s) com sucesso!` : "Todos os campos já estavam preenchidos."}
            </p>
            <button onClick={() => window.close()} className="mt-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90">
              Fechar
            </button>
          </div>
        )}

        {text && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">Ver texto recebido</summary>
            <pre className="mt-2 p-3 bg-muted rounded-lg whitespace-pre-wrap max-h-40 overflow-auto">{text.substring(0, 2000)}</pre>
          </details>
        )}
      </div>
    </div>
  );
};

export default ExtrairTexto;
