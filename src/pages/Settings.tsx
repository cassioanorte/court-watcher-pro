import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Save, Palette } from "lucide-react";
import TeamManagement from "@/components/TeamManagement";
import EprocCredentials from "@/components/EprocCredentials";
import BookmarkletSetup from "@/components/BookmarkletSetup";

const Settings = () => {
  const { tenantId, profile } = useAuth();
  const { toast } = useToast();
  const [firmName, setFirmName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#c8972e");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [oabNumber, setOabNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      const [tenantRes, profileRes] = await Promise.all([
        supabase.from("tenants").select("*").eq("id", tenantId).single(),
        supabase.from("profiles").select("*").eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "").single(),
      ]);
      if (tenantRes.data) {
        setFirmName(tenantRes.data.name);
        setPrimaryColor(tenantRes.data.primary_color || "#c8972e");
      }
      if (profileRes.data) {
        setFullName(profileRes.data.full_name);
        setPhone(profileRes.data.phone || "");
        setOabNumber(profileRes.data.oab_number || "");
      }
      setLoading(false);
    };
    load();
  }, [tenantId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user || !tenantId) throw new Error("Não autenticado");

      const [tenantRes, profileRes] = await Promise.all([
        supabase.from("tenants").update({ name: firmName, primary_color: primaryColor }).eq("id", tenantId),
        supabase.from("profiles").update({ full_name: fullName, phone: phone || null, oab_number: oabNumber || null }).eq("user_id", user.id),
      ]);

      if (tenantRes.error) throw tenantRes.error;
      if (profileRes.error) throw profileRes.error;

      toast({ title: "Salvo!", description: "Configurações atualizadas com sucesso." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-muted-foreground text-sm">Carregando...</div>;

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Personalize seu escritório</p>
      </div>

      {/* Firm settings */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-lg border p-5 shadow-card space-y-4">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Palette className="w-4 h-4 text-accent" /> Escritório (White-label)
        </h2>
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nome do escritório</label>
          <input
            type="text"
            value={firmName}
            onChange={(e) => setFirmName(e.target.value)}
            className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cor primária</label>
          <div className="flex items-center gap-3 mt-1">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-10 h-10 rounded-lg border cursor-pointer"
            />
            <input
              type="text"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-10 px-3 rounded-lg bg-background border text-sm text-foreground w-32 focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
        </div>
      </motion.div>

      {/* Profile settings */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-lg border p-5 shadow-card space-y-4">
        <h2 className="text-base font-semibold text-foreground">Perfil</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nome completo</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">OAB</label>
            <input type="text" value={oabNumber} onChange={(e) => setOabNumber(e.target.value)} placeholder="RS 123456" className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Telefone</label>
            <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(51) 99999-0000" className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" />
          </div>
        </div>
      </motion.div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg gradient-accent text-accent-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar configurações"}
      </button>

      {/* Bookmarklet Setup */}
      <BookmarkletSetup />

      {/* Eproc Credentials */}
      <EprocCredentials />

      {/* Team Management */}
      <TeamManagement />
    </div>
  );
};

export default Settings;
