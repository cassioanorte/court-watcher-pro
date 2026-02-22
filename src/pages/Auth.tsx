import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import lexLogo from "@/assets/lex-imperium-logo.png";

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
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Hero Section */}
      <div className="relative lg:flex-1 flex items-center justify-center p-8 lg:p-16 overflow-hidden" style={{ background: 'linear-gradient(160deg, hsl(210 45% 6%), hsl(210 40% 10%), hsl(210 35% 5%))' }}>
        {/* Radial glow behind logo */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[500px] h-[500px] rounded-full" style={{ background: 'radial-gradient(circle, hsl(43 72% 52% / 0.08) 0%, transparent 70%)' }} />
        </div>
        {/* Subtle particle dots */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full"
              style={{
                background: `hsl(43 72% ${50 + Math.random() * 20}% / ${0.2 + Math.random() * 0.3})`,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -20, 0],
                opacity: [0.2, 0.6, 0.2],
              }}
              transition={{
                duration: 3 + Math.random() * 4,
                repeat: Infinity,
                delay: Math.random() * 3,
              }}
            />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative z-10 text-center"
        >
          <img
            src={lexLogo}
            alt="LEX IMPERIUM"
            className="w-48 h-48 lg:w-64 lg:h-64 object-contain mx-auto mb-6 drop-shadow-2xl"
            style={{ mixBlendMode: 'lighten' }}
          />
          <h1 className="text-3xl lg:text-4xl font-display font-bold tracking-wider gold-glow" style={{ color: 'hsl(43 72% 52%)' }}>
            LEX IMPERIUM
          </h1>
          <p className="mt-3 text-sm lg:text-base tracking-widest uppercase font-body" style={{ color: 'hsl(40 20% 70%)' }}>
            O poder do direito em suas mãos.
          </p>
        </motion.div>
      </div>

      {/* Form Section */}
      <div className="lg:w-[480px] flex items-center justify-center p-6 lg:p-12 bg-card">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="w-full max-w-sm"
        >
          <div className="mb-8">
            <h2 className="text-xl font-display font-bold text-foreground">
              {isLogin ? "Acessar Painel" : "Criar Escritório"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {isLogin ? "Entre com suas credenciais" : "Cadastre seu escritório"}
            </p>
          </div>

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
                    className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
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
                    className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="Silva & Associados"
                  />
                </div>
              </>
            )}
            {isLogin && (
              <div className="flex gap-2 mb-1">
                <button type="button" onClick={() => setLoginMethod("email")} className={`flex-1 h-9 rounded-lg border text-xs font-medium transition-colors ${loginMethod === "email" ? "bg-primary/15 border-primary text-primary" : "bg-background text-muted-foreground hover:bg-muted"}`}>
                  Email
                </button>
                <button type="button" onClick={() => setLoginMethod("cpf")} className={`flex-1 h-9 rounded-lg border text-xs font-medium transition-colors ${loginMethod === "cpf" ? "bg-primary/15 border-primary text-primary" : "bg-background text-muted-foreground hover:bg-muted"}`}>
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
                  className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
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
                  className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
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
                  className="w-full mt-1 h-10 px-3 pr-10 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
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
              className="w-full h-10 rounded-lg gradient-accent text-primary-foreground text-sm font-semibold btn-gold-hover disabled:opacity-50"
            >
              {loading ? "Aguarde..." : isLogin ? "Entrar" : "Criar conta"}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-primary hover:underline"
            >
              {isLogin ? "Não tem conta? Cadastre seu escritório" : "Já tem conta? Faça login"}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
