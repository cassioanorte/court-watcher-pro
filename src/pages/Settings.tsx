import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Save, Palette, Upload, X, Eye } from "lucide-react";
import TeamManagement from "@/components/TeamManagement";
import EprocCredentials from "@/components/EprocCredentials";
import BookmarkletSetup from "@/components/BookmarkletSetup";

const COLOR_PRESETS = [
  { label: "Dourado", value: "#c8972e" },
  { label: "Azul Marinho", value: "#1e3a5f" },
  { label: "Bordô", value: "#722f37" },
  { label: "Verde Escuro", value: "#2d5a3d" },
  { label: "Roxo", value: "#5b3a7a" },
  { label: "Cinza", value: "#4a5568" },
  { label: "Vermelho", value: "#c0392b" },
  { label: "Teal", value: "#1a7a6d" },
];

const Settings = () => {
  const { tenantId, profile, user } = useAuth();
  const { toast } = useToast();
  const [firmName, setFirmName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#c8972e");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [oabNumber, setOabNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      const [tenantRes, profileRes] = await Promise.all([
        supabase.from("tenants").select("*").eq("id", tenantId).single(),
        supabase.from("profiles").select("*").eq("user_id", user?.id ?? "").single(),
      ]);
      if (tenantRes.data) {
        setFirmName(tenantRes.data.name);
        setPrimaryColor(tenantRes.data.primary_color || "#c8972e");
        setLogoUrl(tenantRes.data.logo_url || null);
      }
      if (profileRes.data) {
        setFullName(profileRes.data.full_name);
        setPhone(profileRes.data.phone || "");
        setOabNumber(profileRes.data.oab_number || "");
      }
      setLoading(false);
    };
    load();
  }, [tenantId, user?.id]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenantId) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Erro", description: "Selecione um arquivo de imagem.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Erro", description: "Imagem deve ter no máximo 2MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `logos/${tenantId}/logo.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("case-documents").upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("case-documents").getPublicUrl(path);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      setLogoUrl(publicUrl);

      await supabase.from("tenants").update({ logo_url: publicUrl }).eq("id", tenantId);
      toast({ title: "Logo atualizado!" });
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!tenantId) return;
    await supabase.from("tenants").update({ logo_url: null }).eq("id", tenantId);
    setLogoUrl(null);
    toast({ title: "Logo removido" });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
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

      {/* Firm branding */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-lg border p-5 shadow-card space-y-5">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Palette className="w-4 h-4 text-accent" /> Identidade Visual do Escritório
        </h2>

        {/* Logo upload */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Logotipo</label>
          <div className="flex items-center gap-4 mt-2">
            <div className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/30 shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo do escritório" className="w-full h-full object-contain" />
              ) : (
                <Upload className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-2">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="text-sm font-medium text-accent hover:underline"
              >
                {uploading ? "Enviando..." : logoUrl ? "Alterar logo" : "Enviar logo"}
              </button>
              {logoUrl && (
                <button onClick={handleRemoveLogo} className="text-sm text-destructive hover:underline flex items-center gap-1">
                  <X className="w-3 h-3" /> Remover
                </button>
              )}
              <p className="text-xs text-muted-foreground">PNG, JPG ou SVG. Máx. 2MB.</p>
            </div>
          </div>
        </div>

        {/* Firm name */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nome do escritório</label>
          <input
            type="text"
            value={firmName}
            onChange={(e) => setFirmName(e.target.value)}
            className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>

        {/* Color picker */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cor primária da marca</label>
          <div className="flex items-center gap-3 mt-2">
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
              className="h-10 px-3 rounded-lg bg-background border text-sm text-foreground w-32 focus:outline-none focus:ring-2 focus:ring-accent/40 font-mono"
            />
          </div>
          {/* Color presets */}
          <div className="flex flex-wrap gap-2 mt-3">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => setPrimaryColor(preset.value)}
                className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                  primaryColor === preset.value ? "border-foreground ring-2 ring-accent/40" : "border-transparent"
                }`}
                style={{ backgroundColor: preset.value }}
                title={preset.label}
              />
            ))}
          </div>
        </div>

        {/* Live preview */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Eye className="w-3 h-3" /> Pré-visualização
          </label>
          <div className="mt-2 rounded-lg border overflow-hidden">
            <div className="h-12 flex items-center px-4 gap-3" style={{ backgroundColor: primaryColor }}>
              {logoUrl && (
                <img src={logoUrl} alt="Logo" className="h-8 w-8 object-contain rounded bg-white/20 p-0.5" />
              )}
              <span className="text-sm font-semibold" style={{ color: isLightColor(primaryColor) ? "#1a1a2e" : "#ffffff" }}>
                {firmName || "Nome do Escritório"}
              </span>
            </div>
            <div className="p-4 bg-background space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: primaryColor }} />
                <span className="text-xs text-muted-foreground">Exemplo de destaque com a cor da marca</span>
              </div>
              <button
                className="text-xs font-semibold px-4 py-1.5 rounded-md text-white"
                style={{ backgroundColor: primaryColor }}
              >
                Botão exemplo
              </button>
            </div>
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

/** Returns true if a hex color is "light" (for contrast text) */
function isLightColor(hex: string): boolean {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

export default Settings;
