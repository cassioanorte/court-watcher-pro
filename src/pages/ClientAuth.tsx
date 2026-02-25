import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Scale, Eye, EyeOff, Download, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import defaultLogo from "@/assets/lex-imperium-logo-nobg.png";
import ThemeSelector from "@/components/ThemeSelector";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const ClientAuth = () => {
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState("Portal Jurídico");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Try to get tenant logo from URL or fetch all tenants' first logo
    const fetchLogo = async () => {
      const { data } = await supabase.from("tenants").select("logo_url, name").limit(1).single();
      if (data?.logo_url) setLogoUrl(data.logo_url);
      if (data?.name) setTenantName(data.name);
    };
    fetchLogo();

    // PWA install detection
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Check if already installed (standalone mode)
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsAppInstalled(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const rawCpf = cpf.replace(/\D/g, "");
      if (rawCpf.length !== 11) {
        throw new Error("CPF deve ter 11 dígitos");
      }

      // Look up email by CPF using the database function
      const { data: email, error: lookupError } = await supabase.rpc("get_email_by_cpf", { _cpf: rawCpf });

      if (lookupError) throw lookupError;
      if (!email) throw new Error("CPF não encontrado. Verifique com seu advogado.");

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.includes("Invalid login")) {
          throw new Error("Senha incorreta. Tente novamente.");
        }
        throw error;
      }
      navigate("/portal");
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeSelector />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <img
            src={logoUrl || defaultLogo}
            alt={tenantName}
            className="h-16 mx-auto mb-4 object-contain"
          />
          <h1 className="text-xl font-bold text-foreground font-display">Área do Cliente</h1>
          <p className="text-sm text-muted-foreground mt-1">Acompanhe seus processos</p>
        </div>

        <div className="bg-card rounded-xl p-6 shadow-card border">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">CPF</label>
              <input
                type="text"
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                required
                inputMode="numeric"
                className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
                placeholder="000.000.000-00"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full mt-1 h-10 px-3 pr-10 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 mt-0.5 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-lg gradient-accent text-accent-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>

        {/* PWA Install / Already installed hint */}
        {deferredPrompt && (
          <button
            onClick={async () => {
              await deferredPrompt.prompt();
              const { outcome } = await deferredPrompt.userChoice;
              if (outcome === "accepted") setIsAppInstalled(true);
              setDeferredPrompt(null);
            }}
            className="mt-4 w-full flex items-center gap-3 bg-card border rounded-xl p-4 hover:border-primary/50 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Download className="w-5 h-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">Instalar App do Cliente</p>
              <p className="text-xs text-muted-foreground">Acesso rápido pelo celular ou computador</p>
            </div>
          </button>
        )}

        {!deferredPrompt && isAppInstalled && (
          <div className="mt-4 flex items-center gap-3 bg-card border rounded-xl p-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">App já instalado ✓</p>
              <p className="text-xs text-muted-foreground">Abra o app instalado para acesso rápido</p>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-4">
          É advogado?{" "}
          <a href="/auth" className="text-accent hover:underline font-medium">Acessar painel do escritório</a>
        </p>
      </motion.div>
    </div>
  );
};

export default ClientAuth;
