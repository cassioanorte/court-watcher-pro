import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Save, Eye, Plus, Trash2, Sparkles, ChevronUp, ChevronDown, EyeOff, GripVertical, Loader2, Upload, X, Palette, Wand2 } from "lucide-react";
import { extractColorsFromImage } from "@/lib/extractColors";
import QuizEditor from "@/components/landing/QuizEditor";
import type { QuizConfig } from "@/components/landing/QuizSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/hooks/use-toast";

interface LPBranding {
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  textColor?: string;
  logoHue?: number;
  logoBrightness?: number;
  logoSaturate?: number;
  logoInvert?: number;
}

interface LPContent {
  heroTitle: string;
  heroSubtitle: string;
  heroCtaText: string;
  heroCtaLink: string;
  aboutTitle: string;
  aboutText: string;
  services: { title: string; description: string }[];
  testimonials: { name: string; text: string }[];
  contactTitle: string;
  contactPhone: string;
  contactEmail: string;
  contactAddress: string;
  contactWhatsapp: string;
  footerText: string;
  sections?: { id: string; label: string; visible: boolean }[];
  quiz?: QuizConfig;
  branding?: LPBranding;
}

const DEFAULT_SECTIONS = [
  { id: "hero", label: "Hero / Cabeçalho", visible: true },
  { id: "about", label: "Sobre", visible: true },
  { id: "services", label: "Serviços", visible: true },
  { id: "testimonials", label: "Depoimentos", visible: true },
  { id: "contact", label: "Contato", visible: true },
  { id: "quiz", label: "Quiz", visible: false },
];

const LandingPageEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tenantId } = useAuth();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [template, setTemplate] = useState("classic");
  const [content, setContent] = useState<LPContent>({
    heroTitle: "", heroSubtitle: "", heroCtaText: "", heroCtaLink: "",
    aboutTitle: "", aboutText: "",
    services: [], testimonials: [],
    contactTitle: "", contactPhone: "", contactEmail: "", contactAddress: "",
    contactWhatsapp: "", footerText: "",
    sections: DEFAULT_SECTIONS,
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [extractingColors, setExtractingColors] = useState(false);
  const [aiForm, setAiForm] = useState({
    officeName: "",
    areaOfPractice: "",
    description: "",
    phone: "",
    email: "",
    address: "",
    whatsapp: "",
    website: "",
  });

  const sections = content.sections || DEFAULT_SECTIONS;

  useEffect(() => {
    if (!id || !tenantId) return;
    supabase.from("landing_pages").select("*").eq("id", id).single().then(({ data }) => {
      if (data) {
        const d = data as any;
        setTitle(d.title);
        setSlug(d.slug);
        setTemplate(d.template);
        const loaded = { ...content, ...(d.content || {}) };
        if (!loaded.sections || loaded.sections.length === 0) {
          loaded.sections = DEFAULT_SECTIONS;
        }
        setContent(loaded);
      }
      setLoading(false);
    });
  }, [id, tenantId]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("landing_pages")
      .update({ title, slug, content: content as any } as any)
      .eq("id", id!);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Salvo com sucesso!" });
    }
    setSaving(false);
  };

  const updateContent = (key: keyof LPContent, value: any) => {
    setContent((prev) => ({ ...prev, [key]: value }));
  };

  const updateService = (idx: number, field: string, value: string) => {
    const updated = [...content.services];
    (updated[idx] as any)[field] = value;
    updateContent("services", updated);
  };

  const updateTestimonial = (idx: number, field: string, value: string) => {
    const updated = [...content.testimonials];
    (updated[idx] as any)[field] = value;
    updateContent("testimonials", updated);
  };

  // Section reordering
  const moveSection = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= sections.length) return;
    const updated = [...sections];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    updateContent("sections", updated);
  };

  const toggleSectionVisibility = (idx: number) => {
    const updated = sections.map((s, i) => i === idx ? { ...s, visible: !s.visible } : s);
    updateContent("sections", updated);
  };

  // AI Generation
  const handleAiGenerate = async () => {
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-landing-page", {
        body: aiForm,
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Erro", description: data.error, variant: "destructive" });
        setAiLoading(false);
        return;
      }
      if (data?.content) {
        setContent((prev) => ({
          ...prev,
          ...data.content,
          sections: prev.sections || DEFAULT_SECTIONS,
        }));
        toast({ title: "Conteúdo gerado com IA!", description: "Revise e ajuste conforme necessário." });
        setShowAiDialog(false);
      }
    } catch (err: any) {
      toast({ title: "Erro ao gerar", description: err.message || "Tente novamente", variant: "destructive" });
    }
    setAiLoading(false);
  };

  if (loading) return <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/landing-pages")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Editar Landing Page</h1>
            <p className="text-xs text-muted-foreground font-mono">/lp/{slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAiDialog(true)} className="gap-1">
            <Sparkles className="w-4 h-4" /> Gerar com IA
          </Button>
          <Button variant="outline" size="sm" asChild className="gap-1">
            <a href={`/lp/${slug}?preview=1`} target="_blank" rel="noopener noreferrer">
              <Eye className="w-4 h-4" /> Preview
            </a>
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1">
            <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Section manager (drag & drop) */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card border rounded-xl p-4">
            <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
              <GripVertical className="w-4 h-4 text-muted-foreground" />
              Seções da Página
            </h3>
            <div className="space-y-2">
              {sections.map((section, i) => (
                <div
                  key={section.id}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border transition-all ${
                    section.visible ? "bg-card" : "bg-muted/50 opacity-60"
                  }`}
                >
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveSection(i, -1)}
                      disabled={i === 0}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => moveSection(i, 1)}
                      disabled={i === sections.length - 1}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-sm flex-1 text-foreground">{section.label}</span>
                  <Switch
                    checked={section.visible}
                    onCheckedChange={() => toggleSectionVisibility(i)}
                  />
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">
              Use as setas para reordenar e o toggle para mostrar/ocultar seções.
            </p>
          </div>

          {/* Page info */}
          <div className="bg-card border rounded-xl p-4 space-y-3">
            <div>
              <Label className="text-xs">Título da página</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Slug (URL)</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} className="mt-1" />
            </div>
          </div>
        </div>

        {/* Right: Content editor */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="hero" className="w-full">
            <TabsList className="grid grid-cols-7 w-full">
              <TabsTrigger value="hero">Hero</TabsTrigger>
              <TabsTrigger value="about">Sobre</TabsTrigger>
              <TabsTrigger value="services">Serviços</TabsTrigger>
              <TabsTrigger value="testimonials">Depoimentos</TabsTrigger>
              <TabsTrigger value="contact">Contato</TabsTrigger>
              <TabsTrigger value="quiz">Quiz</TabsTrigger>
              <TabsTrigger value="branding" className="gap-1"><Palette className="w-3 h-3" /> Marca</TabsTrigger>
            </TabsList>

            <TabsContent value="hero" className="space-y-4 mt-4">
              <div>
                <Label>Título principal</Label>
                <Input value={content.heroTitle} onChange={(e) => updateContent("heroTitle", e.target.value)} />
              </div>
              <div>
                <Label>Subtítulo</Label>
                <Input value={content.heroSubtitle} onChange={(e) => updateContent("heroSubtitle", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Texto do botão</Label>
                  <Input value={content.heroCtaText} onChange={(e) => updateContent("heroCtaText", e.target.value)} />
                </div>
                <div>
                  <Label>Link do botão</Label>
                  <Input value={content.heroCtaLink} onChange={(e) => updateContent("heroCtaLink", e.target.value)} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="about" className="space-y-4 mt-4">
              <div>
                <Label>Título</Label>
                <Input value={content.aboutTitle} onChange={(e) => updateContent("aboutTitle", e.target.value)} />
              </div>
              <div>
                <Label>Texto</Label>
                <Textarea value={content.aboutText} onChange={(e) => updateContent("aboutText", e.target.value)} rows={5} />
              </div>
            </TabsContent>

            <TabsContent value="services" className="space-y-4 mt-4">
              {content.services.map((svc, i) => (
                <div key={i} className="flex gap-3 items-start border rounded-lg p-3">
                  <div className="flex-1 space-y-2">
                    <Input value={svc.title} onChange={(e) => updateService(i, "title", e.target.value)} placeholder="Título do serviço" />
                    <Input value={svc.description} onChange={(e) => updateService(i, "description", e.target.value)} placeholder="Descrição" />
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => updateContent("services", content.services.filter((_, j) => j !== i))}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="gap-1" onClick={() => updateContent("services", [...content.services, { title: "", description: "" }])}>
                <Plus className="w-4 h-4" /> Adicionar serviço
              </Button>
            </TabsContent>

            <TabsContent value="testimonials" className="space-y-4 mt-4">
              {content.testimonials.map((t, i) => (
                <div key={i} className="flex gap-3 items-start border rounded-lg p-3">
                  <div className="flex-1 space-y-2">
                    <Input value={t.name} onChange={(e) => updateTestimonial(i, "name", e.target.value)} placeholder="Nome" />
                    <Textarea value={t.text} onChange={(e) => updateTestimonial(i, "text", e.target.value)} placeholder="Depoimento" rows={2} />
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => updateContent("testimonials", content.testimonials.filter((_, j) => j !== i))}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="gap-1" onClick={() => updateContent("testimonials", [...content.testimonials, { name: "", text: "" }])}>
                <Plus className="w-4 h-4" /> Adicionar depoimento
              </Button>
            </TabsContent>

            <TabsContent value="contact" className="space-y-4 mt-4">
              <div>
                <Label>Título da seção</Label>
                <Input value={content.contactTitle} onChange={(e) => updateContent("contactTitle", e.target.value)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Telefone</Label>
                  <Input value={content.contactPhone} onChange={(e) => updateContent("contactPhone", e.target.value)} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={content.contactEmail} onChange={(e) => updateContent("contactEmail", e.target.value)} />
                </div>
                <div>
                  <Label>Endereço</Label>
                  <Input value={content.contactAddress} onChange={(e) => updateContent("contactAddress", e.target.value)} />
                </div>
                <div>
                  <Label>WhatsApp (com DDD)</Label>
                  <Input value={content.contactWhatsapp || ""} onChange={(e) => updateContent("contactWhatsapp", e.target.value)} placeholder="(51) 99999-9999" />
                  <p className="text-[10px] text-muted-foreground mt-1">Um botão flutuante aparecerá na landing page</p>
                </div>
              </div>
              <div>
                <Label>Texto do rodapé</Label>
                <Input value={content.footerText} onChange={(e) => updateContent("footerText", e.target.value)} />
              </div>
            </TabsContent>

            <TabsContent value="quiz" className="mt-4">
              <QuizEditor
                quiz={content.quiz || {} as QuizConfig}
                onChange={(quiz) => {
                  updateContent("quiz" as any, quiz);
                  // Auto-toggle quiz section visibility when quiz is enabled/disabled
                  const currentSections = content.sections || DEFAULT_SECTIONS;
                  const quizSectionIdx = currentSections.findIndex(s => s.id === "quiz");
                  if (quizSectionIdx >= 0) {
                    if (currentSections[quizSectionIdx].visible !== quiz.enabled) {
                      const updatedSections = currentSections.map((s, i) =>
                        i === quizSectionIdx ? { ...s, visible: quiz.enabled } : s
                      );
                      updateContent("sections", updatedSections);
                    }
                  } else {
                    // Quiz section doesn't exist in array, add it
                    updateContent("sections", [...currentSections, { id: "quiz", label: "Quiz", visible: quiz.enabled }]);
                  }
                }}
              />
            </TabsContent>

            <TabsContent value="branding" className="space-y-6 mt-4">
              {/* Logo */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Logotipo do Escritório</Label>
                <div className="flex items-center gap-4">
                  {content.branding?.logoUrl ? (
                    <div className="relative">
                      <img
                        src={content.branding.logoUrl}
                        alt="Logo"
                        className="h-16 max-w-[200px] object-contain rounded-lg border p-2"
                        style={{
                          filter: `hue-rotate(${content.branding?.logoHue ?? 0}deg) brightness(${content.branding?.logoBrightness ?? 100}%) saturate(${content.branding?.logoSaturate ?? 100}%) invert(${content.branding?.logoInvert ?? 0}%)`
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => updateContent("branding", { ...content.branding, logoUrl: undefined })}
                        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer hover:border-accent/50 transition-colors">
                      <Upload className="w-5 h-5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Enviar logotipo</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const ext = file.name.split('.').pop();
                          const path = `lp-logos/${id}-${Date.now()}.${ext}`;
                          const { error } = await supabase.storage.from("case-documents").upload(path, file, { upsert: true });
                          if (error) {
                            toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
                            return;
                          }
                          const { data: urlData } = supabase.storage.from("case-documents").getPublicUrl(path);
                          updateContent("branding", { ...content.branding, logoUrl: urlData.publicUrl });
                          toast({ title: "Logo enviado!" });
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Extract colors from logo button */}
              {content.branding?.logoUrl && (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  disabled={extractingColors}
                  onClick={async () => {
                    if (!content.branding?.logoUrl) return;
                    setExtractingColors(true);
                    try {
                      const colors = await extractColorsFromImage(content.branding.logoUrl, 4);
                      const primary = colors[0] || "#1e293b";
                      const accent = colors[1] || colors[0] || "#f59e0b";
                      // Derive secondary as a very light version of primary
                      const hexToRgb = (hex: string) => {
                        const c = hex.replace("#", "");
                        return [parseInt(c.substring(0, 2), 16), parseInt(c.substring(2, 4), 16), parseInt(c.substring(4, 6), 16)];
                      };
                      const [pr, pg, pb] = hexToRgb(primary);
                      const secondary = `#${Math.min(255, pr + 200).toString(16).padStart(2, "0")}${Math.min(255, pg + 200).toString(16).padStart(2, "0")}${Math.min(255, pb + 200).toString(16).padStart(2, "0")}`;
                      // Text color based on luminance of primary
                      const lum = 0.299 * pr + 0.587 * pg + 0.114 * pb;
                      const textColor = lum < 128 ? "#ffffff" : "#1e293b";
                      updateContent("branding", {
                        ...content.branding,
                        primaryColor: primary,
                        secondaryColor: secondary,
                        accentColor: accent,
                        textColor,
                      });
                      toast({ title: "Cores extraídas do logotipo!", description: "As cores foram aplicadas. Você pode ajustá-las manualmente se preferir." });
                    } catch {
                      toast({ title: "Não foi possível extrair cores", description: "Tente enviar a imagem novamente.", variant: "destructive" });
                    }
                    setExtractingColors(false);
                  }}
                >
                  {extractingColors ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  Usar cores do logotipo na página
                </Button>
              )}

              {/* Logo color adjustments */}
              {content.branding?.logoUrl && (
                <div className="space-y-4 border rounded-lg p-4">
                  <Label className="text-sm font-semibold">Ajuste de cores do logotipo</Label>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Matiz (Hue)</span>
                        <span>{content.branding?.logoHue ?? 0}°</span>
                      </div>
                      <Slider
                        value={[content.branding?.logoHue ?? 0]}
                        onValueChange={([v]) => updateContent("branding", { ...content.branding, logoHue: v })}
                        min={0} max={360} step={1}
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Brilho</span>
                        <span>{content.branding?.logoBrightness ?? 100}%</span>
                      </div>
                      <Slider
                        value={[content.branding?.logoBrightness ?? 100]}
                        onValueChange={([v]) => updateContent("branding", { ...content.branding, logoBrightness: v })}
                        min={0} max={200} step={1}
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Saturação</span>
                        <span>{content.branding?.logoSaturate ?? 100}%</span>
                      </div>
                      <Slider
                        value={[content.branding?.logoSaturate ?? 100]}
                        onValueChange={([v]) => updateContent("branding", { ...content.branding, logoSaturate: v })}
                        min={0} max={200} step={1}
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Inverter</span>
                        <span>{content.branding?.logoInvert ?? 0}%</span>
                      </div>
                      <Slider
                        value={[content.branding?.logoInvert ?? 0]}
                        onValueChange={([v]) => updateContent("branding", { ...content.branding, logoInvert: v })}
                        min={0} max={100} step={1}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Page colors */}
              <div className="space-y-4 border rounded-lg p-4">
                <Label className="text-sm font-semibold">Cores da Página</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Cor primária (Hero/Rodapé)</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="color"
                        value={content.branding?.primaryColor || "#1e293b"}
                        onChange={(e) => updateContent("branding", { ...content.branding, primaryColor: e.target.value })}
                        className="w-10 h-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={content.branding?.primaryColor || "#1e293b"}
                        onChange={(e) => updateContent("branding", { ...content.branding, primaryColor: e.target.value })}
                        className="flex-1 font-mono text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Cor secundária (Fundo alternado)</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="color"
                        value={content.branding?.secondaryColor || "#f8fafc"}
                        onChange={(e) => updateContent("branding", { ...content.branding, secondaryColor: e.target.value })}
                        className="w-10 h-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={content.branding?.secondaryColor || "#f8fafc"}
                        onChange={(e) => updateContent("branding", { ...content.branding, secondaryColor: e.target.value })}
                        className="flex-1 font-mono text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Cor de destaque (Botões/Detalhes)</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="color"
                        value={content.branding?.accentColor || "#f59e0b"}
                        onChange={(e) => updateContent("branding", { ...content.branding, accentColor: e.target.value })}
                        className="w-10 h-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={content.branding?.accentColor || "#f59e0b"}
                        onChange={(e) => updateContent("branding", { ...content.branding, accentColor: e.target.value })}
                        className="flex-1 font-mono text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Cor do texto (sobre primária)</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="color"
                        value={content.branding?.textColor || "#ffffff"}
                        onChange={(e) => updateContent("branding", { ...content.branding, textColor: e.target.value })}
                        className="w-10 h-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={content.branding?.textColor || "#ffffff"}
                        onChange={(e) => updateContent("branding", { ...content.branding, textColor: e.target.value })}
                        className="flex-1 font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">As cores serão aplicadas nas seções da landing page pública.</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* AI Generator Dialog */}
      <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Gerar Conteúdo com IA
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Preencha os dados do escritório e a IA irá gerar todo o conteúdo da landing page automaticamente.
          </p>
          <div className="space-y-3 mt-2">
            <div>
              <Label>Nome do escritório *</Label>
              <Input value={aiForm.officeName} onChange={(e) => setAiForm(f => ({ ...f, officeName: e.target.value }))} placeholder="Ex: Silva & Associados Advocacia" />
            </div>
            <div>
              <Label>Áreas de atuação *</Label>
              <Input value={aiForm.areaOfPractice} onChange={(e) => setAiForm(f => ({ ...f, areaOfPractice: e.target.value }))} placeholder="Ex: Direito Civil, Trabalhista, Empresarial" />
            </div>
            <div>
              <Label>Breve descrição do escritório</Label>
              <Textarea value={aiForm.description} onChange={(e) => setAiForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Escritório com 15 anos de experiência..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Telefone</Label>
                <Input value={aiForm.phone} onChange={(e) => setAiForm(f => ({ ...f, phone: e.target.value }))} placeholder="(51) 99999-9999" />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={aiForm.email} onChange={(e) => setAiForm(f => ({ ...f, email: e.target.value }))} placeholder="contato@escritorio.com" />
              </div>
            </div>
            <div>
              <Label>Endereço</Label>
              <Input value={aiForm.address} onChange={(e) => setAiForm(f => ({ ...f, address: e.target.value }))} placeholder="Rua ..., 123 - Bairro - Cidade/UF" />
            </div>
            <Button
              onClick={handleAiGenerate}
              disabled={aiLoading || !aiForm.officeName.trim() || !aiForm.areaOfPractice.trim()}
              className="w-full gap-2"
            >
              {aiLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Gerando conteúdo...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> Gerar com IA
                </>
              )}
            </Button>
            {aiLoading && (
              <p className="text-xs text-muted-foreground text-center">Isso pode levar alguns segundos...</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LandingPageEditor;
