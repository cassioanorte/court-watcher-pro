import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Mail, MapPin, Scale } from "lucide-react";

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
  sections?: { id: string; label: string; visible: boolean }[];
}

interface LPData {
  title: string;
  template: string;
  content: LPContent;
}

const DEFAULT_SECTIONS = [
  { id: "hero", label: "Hero", visible: true },
  { id: "about", label: "Sobre", visible: true },
  { id: "services", label: "Serviços", visible: true },
  { id: "testimonials", label: "Depoimentos", visible: true },
  { id: "contact", label: "Contato", visible: true },
];

// ── Section renderers per template ──

const classicSections: Record<string, React.FC<{ content: LPContent }>> = {
  hero: ({ content }) => (
    <section className="bg-gradient-to-br from-slate-900 to-slate-700 text-white py-24 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <Scale className="w-12 h-12 mx-auto mb-6 text-amber-400" />
        <h1 className="text-4xl md:text-5xl font-bold mb-4">{content.heroTitle}</h1>
        <p className="text-lg text-slate-300 mb-8 max-w-2xl mx-auto">{content.heroSubtitle}</p>
        {content.heroCtaText && (
          <a href={content.heroCtaLink || "#contato"} className="inline-block bg-amber-500 hover:bg-amber-600 text-white font-semibold px-8 py-3 rounded-lg transition-colors">
            {content.heroCtaText}
          </a>
        )}
      </div>
    </section>
  ),
  about: ({ content }) => content.aboutText ? (
    <section className="py-16 px-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold mb-6 text-center">{content.aboutTitle}</h2>
        <p className="text-gray-600 text-lg leading-relaxed text-center max-w-3xl mx-auto">{content.aboutText}</p>
      </div>
    </section>
  ) : null,
  services: ({ content }) => content.services.length > 0 ? (
    <section className="py-16 px-6 bg-slate-50">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold mb-10 text-center">Áreas de Atuação</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {content.services.map((svc, i) => (
            <div key={i} className="bg-white p-6 rounded-xl shadow-sm border">
              <h3 className="text-lg font-semibold mb-2">{svc.title}</h3>
              <p className="text-gray-600 text-sm">{svc.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  ) : null,
  testimonials: ({ content }) => content.testimonials.length > 0 ? (
    <section className="py-16 px-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold mb-10 text-center">Depoimentos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {content.testimonials.map((t, i) => (
            <div key={i} className="bg-slate-50 p-6 rounded-xl border-l-4 border-amber-500">
              <p className="text-gray-600 italic mb-3">"{t.text}"</p>
              <p className="font-semibold text-sm">{t.name}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  ) : null,
  contact: ({ content }) => (
    <section id="contato" className="py-16 px-6 bg-slate-900 text-white">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-8">{content.contactTitle}</h2>
        <div className="flex flex-wrap justify-center gap-8">
          {content.contactPhone && <a href={`tel:${content.contactPhone}`} className="flex items-center gap-2 text-slate-300 hover:text-amber-400 transition-colors"><Phone className="w-5 h-5" /> {content.contactPhone}</a>}
          {content.contactEmail && <a href={`mailto:${content.contactEmail}`} className="flex items-center gap-2 text-slate-300 hover:text-amber-400 transition-colors"><Mail className="w-5 h-5" /> {content.contactEmail}</a>}
          {content.contactAddress && <span className="flex items-center gap-2 text-slate-300"><MapPin className="w-5 h-5" /> {content.contactAddress}</span>}
        </div>
      </div>
    </section>
  ),
};

const modernSections: Record<string, React.FC<{ content: LPContent }>> = {
  hero: ({ content }) => (
    <section className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 text-white py-28 px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIi8+PC9zdmc+')] opacity-40" />
      <div className="max-w-4xl mx-auto text-center relative z-10">
        <h1 className="text-5xl md:text-6xl font-extrabold mb-4 leading-tight">{content.heroTitle}</h1>
        <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">{content.heroSubtitle}</p>
        {content.heroCtaText && (
          <a href={content.heroCtaLink || "#contato"} className="inline-block bg-white text-indigo-600 font-bold px-10 py-4 rounded-full shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5">
            {content.heroCtaText}
          </a>
        )}
      </div>
    </section>
  ),
  about: ({ content }) => content.aboutText ? (
    <section className="py-20 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl font-extrabold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">{content.aboutTitle}</h2>
        <p className="text-gray-600 text-lg leading-relaxed">{content.aboutText}</p>
      </div>
    </section>
  ) : null,
  services: ({ content }) => content.services.length > 0 ? (
    <section className="py-20 px-6 bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-extrabold mb-12 text-center">Áreas de Atuação</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {content.services.map((svc, i) => (
            <div key={i} className="bg-white p-8 rounded-2xl shadow-md border hover:shadow-lg transition-shadow hover:-translate-y-1">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg mb-4">{i + 1}</div>
              <h3 className="text-lg font-bold mb-2">{svc.title}</h3>
              <p className="text-gray-600 text-sm">{svc.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  ) : null,
  testimonials: ({ content }) => content.testimonials.length > 0 ? (
    <section className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-extrabold mb-12 text-center">O que dizem nossos clientes</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {content.testimonials.map((t, i) => (
            <div key={i} className="bg-gradient-to-br from-indigo-50 to-purple-50 p-8 rounded-2xl">
              <p className="text-gray-700 italic text-lg mb-4">"{t.text}"</p>
              <p className="font-bold text-indigo-600">{t.name}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  ) : null,
  contact: ({ content }) => (
    <section id="contato" className="py-20 px-6 bg-gradient-to-br from-indigo-600 to-purple-600 text-white">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl font-extrabold mb-8">{content.contactTitle}</h2>
        <div className="flex flex-wrap justify-center gap-8">
          {content.contactPhone && <a href={`tel:${content.contactPhone}`} className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"><Phone className="w-5 h-5" /> {content.contactPhone}</a>}
          {content.contactEmail && <a href={`mailto:${content.contactEmail}`} className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"><Mail className="w-5 h-5" /> {content.contactEmail}</a>}
          {content.contactAddress && <span className="flex items-center gap-2 text-white/80"><MapPin className="w-5 h-5" /> {content.contactAddress}</span>}
        </div>
      </div>
    </section>
  ),
};

const minimalSections: Record<string, React.FC<{ content: LPContent }>> = {
  hero: ({ content }) => (
    <section className="py-32 px-6 border-b">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-5xl md:text-6xl font-light mb-6 leading-tight">{content.heroTitle}</h1>
        <p className="text-xl text-gray-500 mb-10">{content.heroSubtitle}</p>
        {content.heroCtaText && (
          <a href={content.heroCtaLink || "#contato"} className="inline-block border-2 border-gray-900 text-gray-900 font-medium px-8 py-3 hover:bg-gray-900 hover:text-white transition-colors">
            {content.heroCtaText}
          </a>
        )}
      </div>
    </section>
  ),
  about: ({ content }) => content.aboutText ? (
    <section className="py-20 px-6 border-b">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-sm font-medium uppercase tracking-widest text-gray-400 mb-6">{content.aboutTitle}</h2>
        <p className="text-gray-600 text-lg leading-relaxed">{content.aboutText}</p>
      </div>
    </section>
  ) : null,
  services: ({ content }) => content.services.length > 0 ? (
    <section className="py-20 px-6 border-b">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-sm font-medium uppercase tracking-widest text-gray-400 mb-10">Áreas de Atuação</h2>
        <div className="space-y-8">
          {content.services.map((svc, i) => (
            <div key={i} className="flex gap-6">
              <span className="text-3xl font-light text-gray-300">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h3 className="text-lg font-medium mb-1">{svc.title}</h3>
                <p className="text-gray-500 text-sm">{svc.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  ) : null,
  testimonials: ({ content }) => content.testimonials.length > 0 ? (
    <section className="py-20 px-6 border-b">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-sm font-medium uppercase tracking-widest text-gray-400 mb-10">Depoimentos</h2>
        <div className="space-y-10">
          {content.testimonials.map((t, i) => (
            <div key={i}>
              <p className="text-xl text-gray-700 italic leading-relaxed mb-3">"{t.text}"</p>
              <p className="text-sm font-medium text-gray-900">— {t.name}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  ) : null,
  contact: ({ content }) => (
    <section id="contato" className="py-20 px-6">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-sm font-medium uppercase tracking-widest text-gray-400 mb-8">{content.contactTitle}</h2>
        <div className="space-y-3">
          {content.contactPhone && <a href={`tel:${content.contactPhone}`} className="flex items-center gap-3 text-gray-600 hover:text-gray-900 transition-colors"><Phone className="w-4 h-4" /> {content.contactPhone}</a>}
          {content.contactEmail && <a href={`mailto:${content.contactEmail}`} className="flex items-center gap-3 text-gray-600 hover:text-gray-900 transition-colors"><Mail className="w-4 h-4" /> {content.contactEmail}</a>}
          {content.contactAddress && <span className="flex items-center gap-3 text-gray-600"><MapPin className="w-4 h-4" /> {content.contactAddress}</span>}
        </div>
      </div>
    </section>
  ),
};

const TEMPLATE_SECTIONS: Record<string, Record<string, React.FC<{ content: LPContent }>>> = {
  classic: classicSections,
  modern: modernSections,
  minimal: minimalSections,
};

const TEMPLATE_WRAPPER: Record<string, { bg: string; footer: string }> = {
  classic: { bg: "bg-white text-gray-900", footer: "py-6 px-6 bg-slate-950 text-center text-sm text-slate-500" },
  modern: { bg: "bg-white text-gray-900", footer: "py-6 px-6 bg-slate-950 text-center text-sm text-slate-500" },
  minimal: { bg: "bg-white text-gray-900", footer: "py-6 px-6 border-t text-center text-xs text-gray-400" },
};

const LandingPagePublic = () => {
  const { slug } = useParams();
  const [data, setData] = useState<LPData | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    supabase
      .from("landing_pages")
      .select("title, template, content")
      .eq("slug", slug)
      .eq("status", "published")
      .limit(1)
      .then(({ data: rows }) => {
        if (rows && rows.length > 0) {
          const r = rows[0] as any;
          setData({ title: r.title, template: r.template, content: r.content });
          document.title = r.title;
        } else {
          setNotFound(true);
        }
      });
  }, [slug]);

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">404</h1>
          <p className="text-gray-500">Página não encontrada</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-gray-400">Carregando...</div>
      </div>
    );
  }

  const templateKey = data.template || "classic";
  const sectionRenderers = TEMPLATE_SECTIONS[templateKey] || classicSections;
  const wrapper = TEMPLATE_WRAPPER[templateKey] || TEMPLATE_WRAPPER.classic;
  const sections = data.content.sections || DEFAULT_SECTIONS;

  return (
    <div className={`min-h-screen ${wrapper.bg}`}>
      {sections
        .filter((s) => s.visible)
        .map((section) => {
          const Renderer = sectionRenderers[section.id];
          if (!Renderer) return null;
          return <Renderer key={section.id} content={data.content} />;
        })}
      <footer className={wrapper.footer}>{data.content.footerText}</footer>
    </div>
  );
};

export default LandingPagePublic;
