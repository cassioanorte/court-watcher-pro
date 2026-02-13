import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Phone, Scale, Clock } from "lucide-react";

const ClientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { tenantId } = useAuth();
  const [client, setClient] = useState<any>(null);
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const [profileRes, casesRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", id).single(),
        supabase.from("cases").select("*").eq("client_user_id", id).order("updated_at", { ascending: false }),
      ]);
      setClient(profileRes.data);
      setCases(casesRes.data || []);
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) return <div className="text-muted-foreground text-sm p-4">Carregando...</div>;
  if (!client) return <div className="text-muted-foreground text-sm p-4">Cliente não encontrado.</div>;

  const sourceLabels: Record<string, string> = {
    TJRS_1G: "TJRS - 1º Grau",
    TJRS_2G: "TJRS - 2º Grau",
    TRF4_JFRS: "TRF4 - JFRS",
    TRF4_JFSC: "TRF4 - JFSC",
    TRF4_JFPR: "TRF4 - JFPR",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Link to="/clientes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Link>

      {/* Client card */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-lg border p-5 shadow-card">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center text-lg font-bold text-primary-foreground">
            {client.full_name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{client.full_name}</h1>
            <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
              {client.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {client.phone}</span>}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Client's cases */}
      <div>
        <h2 className="text-base font-semibold text-foreground mb-3">Processos ({cases.length})</h2>
        {cases.length === 0 ? (
          <p className="text-sm text-muted-foreground bg-card rounded-lg border p-4">Nenhum processo vinculado a este cliente.</p>
        ) : (
          <div className="space-y-3">
            {cases.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <Link
                  to={`/processos/${c.id}`}
                  className="block bg-card rounded-lg border p-4 shadow-card hover:shadow-card-hover transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{c.process_number}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{c.subject || "Sem assunto"}</p>
                    </div>
                    <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                      {sourceLabels[c.source] || c.source}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Scale className="w-3 h-3" /> {c.simple_status}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(c.updated_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientDetail;
