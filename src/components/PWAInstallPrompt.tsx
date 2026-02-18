import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const { tenantId } = useAuth();
  const [tenantName, setTenantName] = useState("Court Watcher Pro");

  useEffect(() => {
    if (!tenantId) return;
    supabase.from("tenants").select("name").eq("id", tenantId).single().then(({ data }) => {
      if (data?.name) {
        setTenantName(data.name);
        document.title = data.name;
      }
    });
  }, [tenantId]);

  useEffect(() => {
    const stored = sessionStorage.getItem("pwa-prompt-dismissed");
    if (stored) {
      setDismissed(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      console.log("PWA instalado com sucesso");
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("pwa-prompt-dismissed", "true");
  };

  if (!deferredPrompt || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-in slide-in-from-bottom-4 duration-500">
      <div className="rounded-xl border bg-card p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Download className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-card-foreground">Instalar {tenantName}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Instale o app no seu dispositivo para acesso rápido e experiência offline.
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={handleInstall}>
                Instalar
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDismiss}>
                Agora não
              </Button>
            </div>
          </div>
          <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
