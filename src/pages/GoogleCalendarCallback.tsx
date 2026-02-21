import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const GoogleCalendarCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      setStatus("error");
      toast.error("Autorização negada pelo Google");
      setTimeout(() => navigate("/"), 2000);
      return;
    }

    if (!code) {
      setStatus("error");
      toast.error("Código de autorização não encontrado");
      setTimeout(() => navigate("/"), 2000);
      return;
    }

    const exchangeCode = async () => {
      try {
        const redirect_uri = `https://court-watcher-pro.lovable.app/google-calendar-callback`;
        const { data, error: fnError } = await supabase.functions.invoke("google-calendar", {
          body: { action: "exchange_code", code, redirect_uri },
        });

        if (fnError || data?.error) {
          throw new Error(data?.error || fnError?.message || "Erro ao trocar código");
        }

        // Store tokens in localStorage (per-user)
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const key = `google_calendar_tokens_${user.id}`;
          localStorage.setItem(key, JSON.stringify({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: Date.now() + (data.expires_in * 1000),
          }));
        }

        setStatus("success");
        toast.success("Google Calendar conectado com sucesso!");
        setTimeout(() => navigate("/agenda"), 1500);
      } catch (err: any) {
        console.error("Token exchange error:", err);
        setStatus("error");
        toast.error(err.message || "Erro ao conectar com Google Calendar");
        setTimeout(() => navigate("/"), 3000);
      }
    };

    exchangeCode();
  }, [searchParams, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-4 p-8">
        {status === "loading" && (
          <>
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-accent" />
            <p className="text-sm text-muted-foreground">Conectando com Google Calendar...</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <span className="text-2xl">✅</span>
            </div>
            <p className="text-sm text-foreground font-medium">Conectado! Redirecionando...</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <span className="text-2xl">❌</span>
            </div>
            <p className="text-sm text-destructive font-medium">Falha na conexão. Redirecionando...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default GoogleCalendarCallback;
