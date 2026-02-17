import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Send, CheckCircle, Loader2 } from "lucide-react";

const LeadCapture = () => {
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get("t");
  const [tenantName, setTenantName] = useState("");
  const [tenantLogo, setTenantLogo] = useState<string | null>(null);
  const [tenantColor, setTenantColor] = useState("#c8972e");
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
  });

  useEffect(() => {
    if (!tenantId) {
      setInvalid(true);
      setLoading(false);
      return;
    }
    const loadTenant = async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, name, logo_url, primary_color")
        .eq("id", tenantId)
        .single();
      if (error || !data) {
        setInvalid(true);
      } else {
        setTenantName(data.name);
        setTenantLogo(data.logo_url);
        if (data.primary_color) setTenantColor(data.primary_color);
      }
      setLoading(false);
    };
    loadTenant();
  }, [tenantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lead-intake`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenant_id: tenantId,
            name: form.name.trim(),
            email: form.email.trim() || undefined,
            phone: form.phone.trim() || undefined,
            notes: form.notes.trim() || undefined,
            origin: "Formulário Web",
          }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erro ao enviar");
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (invalid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-sm">Formulário não encontrado.</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full text-center space-y-4">
          <CheckCircle className="w-16 h-16 mx-auto" style={{ color: tenantColor }} />
          <h2 className="text-xl font-bold text-gray-900">Mensagem enviada!</h2>
          <p className="text-gray-600 text-sm">
            Obrigado pelo contato. A equipe de <strong>{tenantName}</strong> entrará em contato em breve.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          {tenantLogo && (
            <img src={tenantLogo} alt={tenantName} className="h-12 mx-auto object-contain" />
          )}
          <h1 className="text-lg font-bold text-gray-900">{tenantName}</h1>
          <p className="text-sm text-gray-500">
            Preencha seus dados e entraremos em contato
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Nome completo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={255}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ "--tw-ring-color": tenantColor } as any}
              placeholder="Seu nome"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">E-mail</label>
            <input
              type="email"
              maxLength={255}
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ "--tw-ring-color": tenantColor } as any}
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Telefone / WhatsApp</label>
            <input
              type="tel"
              maxLength={30}
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ "--tw-ring-color": tenantColor } as any}
              placeholder="(00) 00000-0000"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Mensagem</label>
            <textarea
              maxLength={2000}
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:border-transparent resize-none"
              style={{ "--tw-ring-color": tenantColor } as any}
              placeholder="Descreva brevemente como podemos ajudar..."
            />
          </div>

          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || !form.name.trim()}
            className="w-full h-10 rounded-lg text-white text-sm font-semibold flex items-center justify-center gap-2 transition-opacity disabled:opacity-50 hover:opacity-90"
            style={{ backgroundColor: tenantColor }}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" /> Enviar
              </>
            )}
          </button>
        </form>

        <p className="text-[10px] text-gray-400 text-center">
          Seus dados são tratados com sigilo e segurança.
        </p>
      </div>
    </div>
  );
};

export default LeadCapture;
