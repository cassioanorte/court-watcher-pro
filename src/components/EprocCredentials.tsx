import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Shield, Eye, EyeOff, Save, Trash2 } from "lucide-react";

type ProcessSource = "TJRS_1G" | "TJRS_2G" | "TRF4_JFRS" | "TRF4_JFSC" | "TRF4_JFPR";

const SOURCES: { value: ProcessSource; label: string }[] = [
  { value: "TJRS_1G", label: "TJRS - 1º Grau" },
  { value: "TJRS_2G", label: "TJRS - 2º Grau" },
  { value: "TRF4_JFRS", label: "TRF4 - JFRS" },
  { value: "TRF4_JFSC", label: "TRF4 - JFSC" },
  { value: "TRF4_JFPR", label: "TRF4 - JFPR" },
];

interface Credential {
  id?: string;
  source: ProcessSource;
  login: string;
  password: string;
  mode: string;
  saved: boolean;
}

const EprocCredentials = () => {
  const { tenantId } = useAuth();
  const { toast } = useToast();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      const { data } = await supabase
        .from("eproc_credentials")
        .select("*")
        .eq("tenant_id", tenantId);

      const existing = (data || []).map((d) => ({
        id: d.id,
        source: d.source as ProcessSource,
        login: "", // Don't show existing credentials
        password: "",
        mode: d.mode,
        saved: true,
      }));

      // Add missing sources
      const existingSources = existing.map((e) => e.source);
      const all = [
        ...existing,
        ...SOURCES.filter((s) => !existingSources.includes(s.value)).map((s) => ({
          source: s.value,
          login: "",
          password: "",
          mode: "login_password",
          saved: false,
        })),
      ];

      setCredentials(all);
      setLoading(false);
    };
    load();
  }, [tenantId]);

  const handleSave = async (cred: Credential) => {
    if (!tenantId || !cred.login || !cred.password) {
      toast({ title: "Erro", description: "Preencha login e senha.", variant: "destructive" });
      return;
    }

    setSaving(cred.source);
    try {
      // Store credentials as encrypted JSON (in production, use vault or proper encryption)
      const encryptedCredentials = JSON.stringify({ login: cred.login, password: cred.password });

      if (cred.id) {
        const { error } = await supabase
          .from("eproc_credentials")
          .update({ encrypted_credentials: encryptedCredentials, mode: "login_password" })
          .eq("id", cred.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("eproc_credentials")
          .insert({
            tenant_id: tenantId,
            source: cred.source,
            encrypted_credentials: encryptedCredentials,
            mode: "login_password",
          });
        if (error) throw error;
      }

      toast({ title: "Credencial salva!", description: `Acesso ao ${cred.source} configurado.` });
      // Reload
      setCredentials((prev) =>
        prev.map((c) => (c.source === cred.source ? { ...c, saved: true, login: "", password: "" } : c))
      );
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (cred: Credential) => {
    if (!cred.id) return;
    try {
      const { error } = await supabase.from("eproc_credentials").delete().eq("id", cred.id);
      if (error) throw error;
      setCredentials((prev) =>
        prev.map((c) => (c.source === cred.source ? { ...c, id: undefined, saved: false } : c))
      );
      toast({ title: "Removida", description: `Credencial do ${cred.source} removida.` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  if (loading) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-card rounded-lg border p-5 shadow-card space-y-4"
    >
      <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
        <Shield className="w-4 h-4 text-accent" /> Credenciais dos Tribunais (eproc)
      </h2>
      <p className="text-xs text-muted-foreground">
        Cadastre seu login e senha do eproc para cada tribunal. A consulta pública de movimentações funciona sem credenciais, mas com login você terá acesso a documentos e dados completos.
      </p>

      <div className="space-y-3">
        {credentials.map((cred) => {
          const sourceLabel = SOURCES.find((s) => s.value === cred.source)?.label || cred.source;
          const showPw = showPasswords[cred.source] || false;

          return (
            <div key={cred.source} className="p-3 bg-background rounded-lg border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{sourceLabel}</span>
                {cred.saved && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-success bg-success/15 px-2 py-0.5 rounded-full">
                      Configurado
                    </span>
                    <button
                      onClick={() => handleDelete(cred)}
                      className="text-destructive/60 hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder={cred.saved ? "••••••" : "Login / OAB"}
                  value={cred.login}
                  onChange={(e) =>
                    setCredentials((prev) =>
                      prev.map((c) => (c.source === cred.source ? { ...c, login: e.target.value } : c))
                    )
                  }
                  className="h-9 px-3 rounded-md bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    placeholder={cred.saved ? "••••••" : "Senha"}
                    value={cred.password}
                    onChange={(e) =>
                      setCredentials((prev) =>
                        prev.map((c) => (c.source === cred.source ? { ...c, password: e.target.value } : c))
                      )
                    }
                    className="w-full h-9 px-3 pr-9 rounded-md bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords((p) => ({ ...p, [cred.source]: !showPw }))}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {(cred.login || cred.password) && (
                <button
                  onClick={() => handleSave(cred)}
                  disabled={saving === cred.source}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md gradient-accent text-accent-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <Save className="w-3 h-3" />
                  {saving === cred.source ? "Salvando..." : cred.saved ? "Atualizar" : "Salvar"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default EprocCredentials;
