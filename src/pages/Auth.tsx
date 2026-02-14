import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Scale, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loginMethod, setLoginMethod] = useState<"email" | "cpf">("email");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [firmName, setFirmName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        let loginEmail = email;

        if (loginMethod === "cpf") {
          const cleanCpf = cpf.replace(/\D/g, "");
          const { data, error } = await supabase.rpc("get_email_by_cpf", { _cpf: cleanCpf });
          if (error || !data) {
            throw new Error("CPF não encontrado no sistema.");
          }
          loginEmail = data;
        }

        const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
        if (error) throw error;
        navigate("/");
      } else {
        const { data, error } = await supabase.functions.invoke("signup-owner", {
          body: { email, password, fullName, firmName },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;

        toast({ title: "Conta criada!", description: "Você já pode acessar o painel." });
        navigate("/");
      }
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-xl gradient-accent flex items-center justify-center mx-auto mb-4">
            <Scale className="w-7 h-7 text-accent-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-primary-foreground font-display">Portal Jurídico</h1>
          <p className="text-sm text-primary-foreground/60 mt-1">
            {isLogin ? "Acesse o painel do escritório" : "Crie sua conta de escritório"}
          </p>
        </div>

        {/* Form */}
        <div className="bg-card rounded-xl p-6 shadow-lg border">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nome completo</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={!isLogin}
                    className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
                    placeholder="Dr. João Silva"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nome do escritório</label>
                  <input
                    type="text"
                    value={firmName}
                    onChange={(e) => setFirmName(e.target.value)}
                    required={!isLogin}
                    className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
                    placeholder="Silva & Associados"
                  />
                </div>
              </>
            )}
            {isLogin && (
              <div className="flex gap-2 mb-1">
                <button type="button" onClick={() => setLoginMethod("email")} className={`flex-1 h-9 rounded-lg border text-xs font-medium transition-colors ${loginMethod === "email" ? "bg-accent/15 border-accent text-accent" : "bg-background text-muted-foreground hover:bg-muted"}`}>
                  Email
                </button>
                <button type="button" onClick={() => setLoginMethod("cpf")} className={`flex-1 h-9 rounded-lg border text-xs font-medium transition-colors ${loginMethod === "cpf" ? "bg-accent/15 border-accent text-accent" : "bg-background text-muted-foreground hover:bg-muted"}`}>
                  CPF
                </button>
              </div>
            )}

            {(loginMethod === "email" || !isLogin) ? (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
                  placeholder="email@escritorio.com"
                />
              </div>
            ) : (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">CPF</label>
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  required
                  className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
                  placeholder="00000000000"
                />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
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
              {loading ? "Aguarde..." : isLogin ? "Entrar" : "Criar conta"}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-accent hover:underline"
            >
              {isLogin ? "Não tem conta? Cadastre seu escritório" : "Já tem conta? Faça login"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
