import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Bell, Clock, ArrowRight, Globe, Phone } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ThemeSelector from "@/components/ThemeSelector";
import defaultLogo from "@/assets/lex-imperium-logo-nobg.png";

type ClientCase = {
  id: string;
  process_number: string;
  subject: string | null;
  simple_status: string | null;
  next_step: string | null;
  updated_at: string;
  source: string;
};

const ClientPortal = () => {
  const { user, profile, tenantId, signOut } = useAuth();
  const navigate = useNavigate();
  const [cases, setCases] = useState<ClientCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantName, setTenantName] = useState("Portal Jurídico");
  const [tenantLogoUrl, setTenantLogoUrl] = useState<string | null>(null);
  const [tenantWhatsapp, setTenantWhatsapp] = useState<string | null>(null);
  const [tenantWebsite, setTenantWebsite] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !tenantId) return;

    const fetchData = async () => {
      const [casesRes, tenantRes] = await Promise.all([
        supabase
          .from("cases")
          .select("id, process_number, subject, simple_status, next_step, updated_at, source")
          .eq("tenant_id", tenantId)
          .eq("client_user_id", user.id),
        supabase
          .from("tenants")
          .select("name, whatsapp, website, logo_url")
          .eq("id", tenantId)
          .single(),
      ]);

      if (casesRes.data) setCases(casesRes.data);
      if (tenantRes.data) {
        setTenantName(tenantRes.data.name || "Portal Jurídico");
        setTenantLogoUrl(tenantRes.data.logo_url || null);
        setTenantWhatsapp((tenantRes.data as any).whatsapp || null);
        setTenantWebsite((tenantRes.data as any).website || null);
      }
      setLoading(false);
    };

    fetchData();
  }, [user, tenantId]);

  const firstName = profile?.full_name?.split(" ")[0] || "Cliente";

  const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "Agora";
    if (hours < 24) return `Há ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Há ${days} dia${days > 1 ? "s" : ""}`;
  };

  const getCourtFromSource = (source: string) => {
    if (source.startsWith("TJRS")) return "TJRS";
    if (source.startsWith("TRF4")) return "TRF4";
    if (source.startsWith("TRT")) return source;
    return source;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="gradient-hero text-sidebar-foreground">
        <div className="max-w-lg mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={tenantLogoUrl || defaultLogo}
              alt={tenantName}
              className="h-9 w-9 rounded-lg object-contain"
            />
            <div>
              <h1 className="text-sm font-bold tracking-wide">{tenantName}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeSelector compact />
            <button className="relative">
              <Bell className="w-5 h-5 opacity-80" />
            </button>
            <button
              onClick={async () => { await signOut(); navigate("/portal/login"); }}
              className="text-[10px] opacity-70 hover:opacity-100 uppercase tracking-wide"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Welcome */}
      <div className="max-w-lg mx-auto px-4 py-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-xl font-bold text-foreground">Olá, {firstName} 👋</h2>
          <p className="text-sm text-muted-foreground mt-1">Acompanhe seus processos em tempo real</p>
        </motion.div>

        {/* Processes */}
        <div className="mt-6 space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : cases.length === 0 ? (
            <div className="bg-card rounded-xl border shadow-card p-8 text-center">
              <p className="text-sm text-muted-foreground">Nenhum processo encontrado.</p>
            </div>
          ) : (
            cases.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.1 }}
              >
                <Link to={`/portal/processo/${p.id}`} className="block bg-card rounded-xl border shadow-card p-4 hover:shadow-card-hover transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground">{p.subject || "Sem assunto"}</h3>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">{p.process_number}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground mt-0.5" />
                  </div>

                  <div className="space-y-2">
                    <div className="bg-accent/8 rounded-lg p-3">
                      <p className="text-[10px] font-semibold text-accent uppercase tracking-wide mb-0.5">Status Atual</p>
                      <p className="text-sm text-foreground">{p.simple_status || "Cadastrado"}</p>
                    </div>
                    {p.next_step && (
                      <p className="text-xs text-muted-foreground">Próximo passo: {p.next_step}</p>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {getTimeAgo(p.updated_at)}</span>
                      <span className="bg-muted px-2 py-0.5 rounded-full">{getCourtFromSource(p.source)}</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))
          )}
        </div>

        {/* Quick actions */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          {tenantWhatsapp && (
            <a
              href={`https://wa.me/${tenantWhatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-[#25D366]/10 rounded-xl border border-[#25D366]/30 p-4 text-sm font-medium text-foreground hover:shadow-card transition-shadow"
            >
              <Phone className="w-5 h-5 text-[#25D366]" /> WhatsApp
            </a>
          )}
          {tenantWebsite && (
            <a
              href={tenantWebsite.startsWith("http") ? tenantWebsite : `https://${tenantWebsite}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-card rounded-xl border p-4 text-sm font-medium text-foreground hover:shadow-card transition-shadow overflow-hidden"
            >
              <Globe className="w-5 h-5 text-accent shrink-0" /> <span className="truncate">Nosso Site</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientPortal;
