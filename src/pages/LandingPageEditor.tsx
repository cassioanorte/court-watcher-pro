import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Save, Eye, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";

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
  footerText: string;
}

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
    footerText: "",
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !tenantId) return;
    supabase.from("landing_pages").select("*").eq("id", id).single().then(({ data }) => {
      if (data) {
        const d = data as any;
        setTitle(d.title);
        setSlug(d.slug);
        setTemplate(d.template);
        setContent({ ...content, ...(d.content || {}) });
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

  if (loading) return <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
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
          <Button variant="outline" size="sm" asChild className="gap-1">
            <a href={`/lp/${slug}`} target="_blank" rel="noopener noreferrer">
              <Eye className="w-4 h-4" /> Preview
            </a>
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1">
            <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Título da página</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Slug (URL)</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
          </div>
        </div>

        <Tabs defaultValue="hero" className="w-full">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="hero">Hero</TabsTrigger>
            <TabsTrigger value="about">Sobre</TabsTrigger>
            <TabsTrigger value="services">Serviços</TabsTrigger>
            <TabsTrigger value="testimonials">Depoimentos</TabsTrigger>
            <TabsTrigger value="contact">Contato</TabsTrigger>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            </div>
            <div>
              <Label>Texto do rodapé</Label>
              <Input value={content.footerText} onChange={(e) => updateContent("footerText", e.target.value)} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default LandingPageEditor;
