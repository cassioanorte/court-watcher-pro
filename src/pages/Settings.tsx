import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Save, Palette, Upload, X, Eye, EyeOff, RotateCcw, Wand2, Lock } from "lucide-react";
import TeamManagement from "@/components/TeamManagement";
import DashboardAICredits from "@/components/dashboard/DashboardAICredits";
import StaffAccessControl from "@/components/StaffAccessControl";
import EprocCredentials from "@/components/EprocCredentials";
import BookmarkletSetup from "@/components/BookmarkletSetup";
import MassImportBookmarklet from "@/components/MassImportBookmarklet";
import ExtractDataBookmarklet from "@/components/ExtractDataBookmarklet";
import DocumentCaptureBookmarklet from "@/components/DocumentCaptureBookmarklet";
import EprocSessionSync from "@/components/EprocSessionSync";
import ApiKeyManager from "@/components/ApiKeyManager";
import { type ThemeColors, DEFAULT_THEME, applyTheme, applyLogoOnly, getLogoFilter } from "@/hooks/useTheme";
import { extractColorsFromImage, generateThemePresetsFromColors } from "@/lib/extractColors";

const THEME_PRESETS: { label: string; colors: ThemeColors }[] = [
  {
    label: "Clássico Jurídico",
    colors: { sidebar: "#1a2332", sidebarText: "#d4d8e0", accent: "#c8972e", background: "#f5f6f8", card: "#ffffff", foreground: "#1a2332" },
  },
  {
    label: "Azul Corporativo",
    colors: { sidebar: "#1e3a5f", sidebarText: "#e0e8f0", accent: "#3b82f6", background: "#f0f4f8", card: "#ffffff", foreground: "#1e293b" },
  },
  {
    label: "Bordô Elegante",
    colors: { sidebar: "#3b1220", sidebarText: "#f0d0d8", accent: "#b91c4a", background: "#fdf2f4", card: "#ffffff", foreground: "#2a0a14" },
  },
  {
    label: "Verde Natureza",
    colors: { sidebar: "#14352a", sidebarText: "#c8e6d8", accent: "#16a34a", background: "#f0faf4", card: "#ffffff", foreground: "#14352a" },
  },
  {
    label: "Escuro Moderno",
    colors: { sidebar: "#0f0f12", sidebarText: "#a8a8b0", accent: "#8b5cf6", background: "#18181b", card: "#27272a", foreground: "#e4e4e7" },
  },
  {
    label: "Cinza Minimalista",
    colors: { sidebar: "#374151", sidebarText: "#d1d5db", accent: "#6b7280", background: "#f9fafb", card: "#ffffff", foreground: "#111827" },
  },
];

const COLOR_FIELDS: { key: keyof ThemeColors; label: string; description: string }[] = [
  { key: "sidebar", label: "Barra lateral", description: "Fundo da navegação" },
  { key: "sidebarText", label: "Texto da barra lateral", description: "Cor dos links" },
  { key: "accent", label: "Cor de destaque", description: "Botões, ícones, links ativos" },
  { key: "background", label: "Fundo da página", description: "Área principal" },
  { key: "card", label: "Cor dos cards", description: "Painéis e caixas" },
  { key: "foreground", label: "Texto principal", description: "Títulos e parágrafos" },
];

const ChangePasswordSection = () => {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleChange = async () => {
    if (newPw.length < 6) {
      toast({ title: "Erro", description: "A nova senha deve ter no mínimo 6 caracteres.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      setCurrentPw("");
      setNewPw("");
      toast({ title: "Sucesso!", description: "Senha alterada com sucesso." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md space-y-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nova senha</label>
        <div className="relative">
          <input
            type={showPw ? "text" : "password"}
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            className="w-full mt-1 h-10 px-3 pr-10 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 mt-0.5 text-muted-foreground hover:text-foreground">
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <button
        onClick={handleChange}
        disabled={saving || newPw.length < 6}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg gradient-accent text-accent-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Alterar senha"}
      </button>
    </div>
  );
};

const Settings = () => {
  const { tenantId, user } = useAuth();
  const { toast } = useToast();
  const [firmName, setFirmName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [themeColors, setThemeColors] = useState<ThemeColors>(DEFAULT_THEME);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [oabNumber, setOabNumber] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [website, setWebsite] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [logoPresets, setLogoPresets] = useState<{ label: string; colors: { sidebar: string; sidebarText: string; accent: string; background: string; card: string; foreground: string } }[] | null>(null);
  const [editingPreset, setEditingPreset] = useState<{ sidebar: string; sidebarText: string; accent: string; background: string; card: string; foreground: string } | null>(null);
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
        setLogoUrl(tenantRes.data.logo_url || null);
        setWhatsapp((tenantRes.data as any).whatsapp || "");
        setWebsite((tenantRes.data as any).website || "");
        const saved = tenantRes.data.theme_colors as unknown as Partial<ThemeColors> | null;
        if (saved && Object.keys(saved).length > 0) {
          setThemeColors({ ...DEFAULT_THEME, ...saved });
        } else if (tenantRes.data.primary_color) {
          setThemeColors({ ...DEFAULT_THEME, accent: tenantRes.data.primary_color });
        }
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

  const updateColor = (key: keyof ThemeColors, value: string | number) => {
    setThemeColors((prev) => ({ ...prev, [key]: value }));
  };

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

  const handleApply = () => {
    applyTheme(themeColors);
    toast({ title: "Aplicado!", description: "Cores do site alteradas na visualização. Clique em Salvar para persistir." });
  };

  const handleSaveBranding = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("tenants").update({
        name: firmName,
        primary_color: themeColors.accent,
        logo_url: logoUrl,
        theme_colors: themeColors as unknown as Record<string, string>,
      }).eq("id", tenantId);
      if (error) throw error;
      applyTheme(themeColors);
      toast({ title: "Salvo!", description: "Identidade visual salva com sucesso." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("profiles").update({
        full_name: fullName,
        phone: phone || null,
        oab_number: oabNumber || null,
      }).eq("user_id", user.id);
      if (error) throw error;
      toast({ title: "Perfil salvo!" });
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
            <div className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center overflow-hidden shrink-0" style={{ backgroundColor: themeColors.logoBg || undefined, background: themeColors.logoBg ? undefined : 'var(--gradient-accent)' }}>
              {logoUrl ? (
                <img src={logoUrl} alt="Logo do escritório" className="w-full h-full object-contain" style={{ filter: getLogoFilter(themeColors) }} />
              ) : (
                <Upload className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-2">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="text-sm font-medium text-accent hover:underline">
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
          {/* Logo color adjustments */}
          {logoUrl && (
            <div className="mt-3 space-y-3 p-3 rounded-lg bg-muted/30 border">
              <p className="text-xs font-semibold text-foreground">Ajustar logo</p>
              {/* Logo background color */}
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={themeColors.logoBg || "#c8972e"}
                  onChange={(e) => updateColor("logoBg", e.target.value)}
                  className="w-9 h-9 rounded-md border cursor-pointer shrink-0"
                />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-foreground">Fundo do logo</p>
                  <p className="text-[10px] text-muted-foreground">Cor atrás do logotipo na sidebar</p>
                </div>
                <input
                  type="text"
                  value={themeColors.logoBg || ""}
                  onChange={(e) => updateColor("logoBg", e.target.value)}
                  placeholder="Padrão"
                  className="w-20 h-7 px-2 rounded bg-background border text-[11px] font-mono text-foreground focus:outline-none"
                />
                <button
                  onClick={() => updateColor("logoBg", "transparent")}
                  className="text-[10px] text-accent hover:underline shrink-0"
                >
                  Transparente
                </button>
              </div>
              {/* Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground">Matiz ({themeColors.logoHue ?? 0}°)</label>
                  <input type="range" min="0" max="360" value={themeColors.logoHue ?? 0}
                    onChange={(e) => updateColor("logoHue", Number(e.target.value))}
                    className="w-full h-1.5 accent-accent cursor-pointer" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Brilho ({themeColors.logoBrightness ?? 100}%)</label>
                  <input type="range" min="0" max="200" value={themeColors.logoBrightness ?? 100}
                    onChange={(e) => updateColor("logoBrightness", Number(e.target.value))}
                    className="w-full h-1.5 accent-accent cursor-pointer" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Saturação ({themeColors.logoSaturate ?? 100}%)</label>
                  <input type="range" min="0" max="200" value={themeColors.logoSaturate ?? 100}
                    onChange={(e) => updateColor("logoSaturate", Number(e.target.value))}
                    className="w-full h-1.5 accent-accent cursor-pointer" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Inverter ({themeColors.logoInvert ?? 0}%)</label>
                  <input type="range" min="0" max="100" value={themeColors.logoInvert ?? 0}
                    onChange={(e) => updateColor("logoInvert", Number(e.target.value))}
                    className="w-full h-1.5 accent-accent cursor-pointer" />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={() => {
                    setThemeColors((prev) => ({ ...prev, logoBg: undefined, logoHue: 0, logoBrightness: 100, logoSaturate: 100, logoInvert: 0 }));
                  }}
                  className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Resetar
                </button>
                <button
                  onClick={() => { applyLogoOnly(themeColors); toast({ title: "Aplicado!", description: "Fundo e filtros do logo atualizados na visualização." }); }}
                  className="text-[11px] font-semibold text-accent hover:underline flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" /> Aplicar logo
                </button>
              </div>
            </div>
          )}

          {/* Extract colors from logo */}
          {logoUrl && (
            <div className="mt-3 space-y-3">
              <button
                onClick={async () => {
                  if (!logoUrl) return;
                  setExtracting(true);
                  setLogoPresets(null);
                  try {
                    const colors = await extractColorsFromImage(logoUrl);
                    const presets = generateThemePresetsFromColors(colors);
                    setLogoPresets(presets);
                    toast({ title: "Cores extraídas!", description: `${colors.length} cor(es) encontrada(s) no logotipo.` });
                  } catch {
                    toast({ title: "Erro", description: "Não foi possível extrair cores do logotipo.", variant: "destructive" });
                  } finally {
                    setExtracting(false);
                  }
                }}
                disabled={extracting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-accent/40 text-sm font-semibold text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
              >
                <Wand2 className="w-4 h-4" /> {extracting ? "Extraindo..." : "Usar as Cores do Logotipo no Site"}
              </button>

              {logoPresets && (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Temas baseados no logo</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {logoPresets.map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => setEditingPreset({ ...preset.colors })}
                        className="rounded-lg border p-3 hover:border-accent/60 transition-all text-left"
                      >
                        <div className="flex gap-1 mb-2">
                          {[preset.colors.sidebar, preset.colors.accent, preset.colors.background, preset.colors.card].map((c, i) => (
                            <div key={i} className="w-5 h-5 rounded-full border border-border/50" style={{ backgroundColor: c }} />
                          ))}
                        </div>
                        <p className="text-[11px] font-medium text-foreground">{preset.label}</p>
                      </button>
                    ))}
                  </div>

                  {/* Editable preset colors */}
                  {editingPreset && (
                    <div className="p-3 rounded-lg bg-muted/30 border space-y-3">
                      <p className="text-xs font-semibold text-foreground">Ajuste as cores antes de aplicar</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {COLOR_FIELDS.map((field) => (
                          <div key={field.key} className="flex items-center gap-2 p-2 rounded-lg bg-background border">
                            <input
                              type="color"
                              value={editingPreset[field.key as keyof typeof editingPreset] || "#000000"}
                              onChange={(e) => setEditingPreset((prev) => prev ? { ...prev, [field.key]: e.target.value } : prev)}
                              className="w-8 h-8 rounded-md border cursor-pointer shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-semibold text-foreground">{field.label}</p>
                            </div>
                            <input
                              type="text"
                              value={editingPreset[field.key as keyof typeof editingPreset] || ""}
                              onChange={(e) => setEditingPreset((prev) => prev ? { ...prev, [field.key]: e.target.value } : prev)}
                              className="w-20 h-7 px-2 rounded bg-background border text-[11px] font-mono text-foreground focus:outline-none"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingPreset(null)}
                          className="text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => {
                            applyTheme({ ...themeColors, ...editingPreset });
                            toast({ title: "Pré-visualização aplicada!" });
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
                        >
                          <Eye className="w-3 h-3" /> Pré-visualizar
                        </button>
                        <button
                          onClick={() => {
                            setThemeColors((prev) => ({ ...prev, ...editingPreset }));
                            applyTheme({ ...themeColors, ...editingPreset });
                            setEditingPreset(null);
                            toast({ title: "Cores aplicadas!", description: "Clique em Salvar para persistir." });
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg gradient-accent text-accent-foreground text-[11px] font-semibold hover:opacity-90"
                        >
                          <Save className="w-3 h-3" /> Usar estas cores
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">WhatsApp do escritório</label>
            <input
              type="text"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="55519999999999"
              className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Número com DDD e DDI (ex: 5551999999999)</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Site do escritório</label>
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://www.seuescritorio.com.br"
              className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
        </div>

        {/* Logo & name save button */}
        <div className="pt-2 border-t">
          <button
            onClick={async () => {
              if (!tenantId) return;
              setSaving(true);
              try {
                const updateData: any = { name: firmName, logo_url: logoUrl, whatsapp: whatsapp || null, website: website || null };
                const { error } = await supabase.from("tenants").update(updateData).eq("id", tenantId);
                if (error) throw error;
                toast({ title: "Salvo!", description: "Dados do escritório atualizados com sucesso." });
              } catch (err: any) {
                toast({ title: "Erro", description: err.message, variant: "destructive" });
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg gradient-accent text-accent-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar logo e nome"}
          </button>
        </div>

        {/* Theme presets */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Temas prontos</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => setThemeColors(preset.colors)}
                className="rounded-lg border p-2 hover:border-accent/60 transition-all text-left"
              >
                <div className="flex gap-1 mb-1.5">
                  {[preset.colors.sidebar, preset.colors.accent, preset.colors.background, preset.colors.card].map((c, i) => (
                    <div key={i} className="w-5 h-5 rounded-full border border-border/50" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <p className="text-[11px] font-medium text-foreground truncate">{preset.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Individual color fields */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cores personalizadas</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            {COLOR_FIELDS.map((field) => (
              <div key={field.key} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 border">
                <input
                  type="color"
                  value={themeColors[field.key]}
                  onChange={(e) => updateColor(field.key, e.target.value)}
                  className="w-9 h-9 rounded-md border cursor-pointer shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">{field.label}</p>
                  <p className="text-[10px] text-muted-foreground">{field.description}</p>
                </div>
                <input
                  type="text"
                  value={themeColors[field.key]}
                  onChange={(e) => updateColor(field.key, e.target.value)}
                  className="w-20 h-7 px-2 rounded bg-background border text-[11px] font-mono text-foreground focus:outline-none"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Live preview */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Eye className="w-3 h-3" /> Pré-visualização
          </label>
          <div className="mt-2 rounded-lg border overflow-hidden">
            {/* Simulated sidebar */}
            <div className="flex">
              <div className="w-40 p-3 space-y-1.5" style={{ backgroundColor: themeColors.sidebar }}>
                <div className="flex items-center gap-2">
                  {logoUrl && <img src={logoUrl} alt="Logo" className="h-5 w-5 object-contain rounded" />}
                  <span className="text-[10px] font-bold truncate" style={{ color: themeColors.sidebarText }}>
                    {firmName || "Escritório"}
                  </span>
                </div>
                <div className="rounded px-2 py-1" style={{ backgroundColor: themeColors.accent + "30" }}>
                  <span className="text-[10px] font-medium" style={{ color: themeColors.accent }}>Dashboard</span>
                </div>
                <div className="px-2 py-1">
                  <span className="text-[10px]" style={{ color: themeColors.sidebarText + "99" }}>Processos</span>
                </div>
              </div>
              {/* Simulated main area */}
              <div className="flex-1 p-3 space-y-2" style={{ backgroundColor: themeColors.background }}>
                <p className="text-xs font-bold" style={{ color: themeColors.foreground }}>Dashboard</p>
                <div className="flex gap-2">
                  <div className="flex-1 p-2 rounded-md" style={{ backgroundColor: themeColors.card }}>
                    <p className="text-[10px]" style={{ color: themeColors.foreground + "80" }}>Processos</p>
                    <p className="text-sm font-bold" style={{ color: themeColors.foreground }}>42</p>
                  </div>
                  <div className="flex-1 p-2 rounded-md" style={{ backgroundColor: themeColors.card }}>
                    <p className="text-[10px]" style={{ color: themeColors.foreground + "80" }}>Clientes</p>
                    <p className="text-sm font-bold" style={{ color: themeColors.foreground }}>18</p>
                  </div>
                </div>
                <button className="text-[10px] font-semibold px-3 py-1 rounded text-white" style={{ backgroundColor: themeColors.accent }}>
                  Botão exemplo
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Branding action buttons */}
        <div className="flex items-center gap-3 pt-2 border-t">
          <button
            onClick={() => { setThemeColors(DEFAULT_THEME); applyTheme(DEFAULT_THEME); toast({ title: "Tema restaurado ao padrão." }); }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Restaurar padrão
          </button>
          <button
            onClick={handleApply}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
          >
            <Eye className="w-4 h-4" /> Aplicar
          </button>
          <button
            onClick={handleSaveBranding}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg gradient-accent text-accent-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar"}
          </button>
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
        <div className="pt-2 border-t">
          <button onClick={handleSaveProfile} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg gradient-accent text-accent-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar perfil"}
          </button>
        </div>
      </motion.div>

      {/* AI Credits */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
        <DashboardAICredits compact />
      </motion.div>

      {/* Change own password */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card rounded-lg border p-5 shadow-card space-y-4">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2"><Lock className="w-4 h-4" /> Alterar minha senha</h2>
        <ChangePasswordSection />
      </motion.div>

      <EprocSessionSync />
      <MassImportBookmarklet />
      <BookmarkletSetup />
      <DocumentCaptureBookmarklet />
      <ExtractDataBookmarklet />
      {/* EprocCredentials oculto — mantido no código caso volte a ser útil */}
      {/* <EprocCredentials /> */}
      <TeamManagement />
      <StaffAccessControl />
    </div>
  );
};

export default Settings;
