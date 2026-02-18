import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Globe, Pencil, Trash2, Eye, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface LandingPage {
  id: string;
  title: string;
  slug: string;
  template: string;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  content: any;
}

const TEMPLATES = [
  {
    id: "classic",
    name: "Clássico",
    description: "Layout tradicional com hero, serviços, depoimentos e contato",
    preview: "📋",
  },
  {
    id: "modern",
    name: "Moderno",
    description: "Design moderno com gradientes, animações e seções destacadas",
    preview: "✨",
  },
  {
    id: "minimal",
    name: "Minimalista",
    description: "Layout limpo e direto ao ponto, foco no conteúdo",
    preview: "🎯",
  },
];

const DEFAULT_CONTENT = {
  heroTitle: "Seu Escritório de Advocacia",
  heroSubtitle: "Defendemos seus direitos com excelência e dedicação",
  heroCtaText: "Fale Conosco",
  heroCtaLink: "#contato",
  aboutTitle: "Sobre Nós",
  aboutText: "Somos um escritório de advocacia com anos de experiência...",
  services: [
    { title: "Direito Civil", description: "Consultoria e representação em questões civis" },
    { title: "Direito Trabalhista", description: "Defesa dos direitos do trabalhador" },
    { title: "Direito Empresarial", description: "Assessoria jurídica para empresas" },
  ],
  testimonials: [
    { name: "João Silva", text: "Excelente atendimento e resultado positivo no meu caso." },
    { name: "Maria Santos", text: "Profissionais dedicados e competentes." },
  ],
  contactTitle: "Entre em Contato",
  contactPhone: "(51) 99999-9999",
  contactEmail: "contato@escritorio.com.br",
  contactAddress: "Rua Exemplo, 123 - Centro",
  footerText: "© 2025 Escritório de Advocacia. Todos os direitos reservados.",
};

const LandingPages = () => {
  const { tenantId, user } = useAuth();
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("classic");
  const [creating, setCreating] = useState(false);

  const fetchPages = async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from("landing_pages")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    setPages((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchPages();
  }, [tenantId]);

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleTitleChange = (val: string) => {
    setNewTitle(val);
    setNewSlug(generateSlug(val));
  };

  const handleCreate = async () => {
    if (!tenantId || !user || !newTitle.trim() || !newSlug.trim()) return;
    setCreating(true);
    const { error } = await supabase.from("landing_pages").insert({
      tenant_id: tenantId,
      created_by: user.id,
      title: newTitle.trim(),
      slug: newSlug.trim(),
      template: selectedTemplate,
      content: DEFAULT_CONTENT,
    } as any);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Landing page criada!" });
      setShowNew(false);
      setNewTitle("");
      setNewSlug("");
      fetchPages();
    }
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta landing page?")) return;
    await supabase.from("landing_pages").delete().eq("id", id);
    fetchPages();
    toast({ title: "Landing page excluída" });
  };

  const handleTogglePublish = async (page: LandingPage) => {
    const newStatus = page.status === "published" ? "draft" : "published";
    await supabase
      .from("landing_pages")
      .update({
        status: newStatus,
        published_at: newStatus === "published" ? new Date().toISOString() : null,
      } as any)
      .eq("id", page.id);
    fetchPages();
    toast({ title: newStatus === "published" ? "Publicada!" : "Despublicada" });
  };

  const copyUrl = (slug: string) => {
    const url = `${window.location.origin}/lp/${slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: "URL copiada!" });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Landing Pages</h1>
          <p className="text-sm text-muted-foreground mt-1">Crie páginas de captura para seu escritório</p>
        </div>
        <Button onClick={() => setShowNew(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Landing Page
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : pages.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16 space-y-4">
          <Globe className="w-16 h-16 mx-auto text-muted-foreground/30" />
          <h2 className="text-lg font-semibold text-foreground">Nenhuma landing page ainda</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Crie uma landing page profissional para seu escritório em minutos usando nossos templates prontos.
          </p>
          <Button onClick={() => setShowNew(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Criar Primeira Landing Page
          </Button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pages.map((page, i) => (
            <motion.div
              key={page.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card border rounded-xl p-5 space-y-3 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">{page.title}</h3>
                  <p className="text-xs text-muted-foreground font-mono mt-1">/lp/{page.slug}</p>
                </div>
                <Badge variant={page.status === "published" ? "default" : "secondary"}>
                  {page.status === "published" ? "Publicada" : "Rascunho"}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                Template: {TEMPLATES.find(t => t.id === page.template)?.name || page.template}
              </div>
              <div className="flex items-center gap-2 pt-2 border-t">
                <Button variant="ghost" size="sm" asChild className="gap-1 text-xs">
                  <Link to={`/landing-pages/${page.id}`}>
                    <Pencil className="w-3 h-3" /> Editar
                  </Link>
                </Button>
                {page.status === "published" && (
                  <>
                    <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => copyUrl(page.slug)}>
                      <Copy className="w-3 h-3" /> URL
                    </Button>
                    <Button variant="ghost" size="sm" asChild className="gap-1 text-xs">
                      <a href={`/lp/${page.slug}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3 h-3" /> Ver
                      </a>
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => handleTogglePublish(page)}
                >
                  <Eye className="w-3 h-3" /> {page.status === "published" ? "Despublicar" : "Publicar"}
                </Button>
                <Button variant="ghost" size="sm" className="gap-1 text-xs text-destructive hover:text-destructive" onClick={() => handleDelete(page.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* New Landing Page Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Landing Page</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da página</Label>
              <Input value={newTitle} onChange={(e) => handleTitleChange(e.target.value)} placeholder="Ex: Escritório Silva Advocacia" />
            </div>
            <div>
              <Label>Slug (URL)</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">/lp/</span>
                <Input value={newSlug} onChange={(e) => setNewSlug(e.target.value)} placeholder="meu-escritorio" />
              </div>
            </div>
            <div>
              <Label>Template</Label>
              <div className="grid grid-cols-1 gap-2 mt-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTemplate(t.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                      selectedTemplate === t.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "hover:border-muted-foreground/30"
                    }`}
                  >
                    <span className="text-2xl">{t.preview}</span>
                    <div>
                      <p className="font-medium text-sm text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={handleCreate} disabled={creating || !newTitle.trim()} className="w-full">
              {creating ? "Criando..." : "Criar Landing Page"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LandingPages;
