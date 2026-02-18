import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Mail, MapPin, Scale } from "lucide-react";
import QuizSection from "@/components/landing/QuizSection";
import type { QuizConfig } from "@/components/landing/QuizSection";

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
  contactWhatsapp?: string;
  footerText: string;
  sections?: { id: string; label: string; visible: boolean }[];
  quiz?: QuizConfig;
}

interface LPData {
  title: string;
  template: string;
  content: LPContent;
  tenant_id: string;
}

const DEFAULT_SECTIONS = [
  { id: "hero", label: "Hero", visible: true },
  { id: "about", label: "Sobre", visible: true },
  { id: "services", label: "Serviços", visible: true },
  { id: "testimonials", label: "Depoimentos", visible: true },
  { id: "contact", label: "Contato", visible: true },
  { id: "quiz", label: "Quiz", visible: false },
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
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get("preview") === "1";
  const [data, setData] = useState<LPData | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    const query = supabase
      .from("landing_pages")
      .select("title, template, content, tenant_id")
      .eq("slug", slug);
    
    // In preview mode, show any status; otherwise only published
    if (!isPreview) {
      query.eq("status", "published");
    }

    query.limit(1).then(({ data: rows }) => {
      if (rows && rows.length > 0) {
        const r = rows[0] as any;
        setData({ title: r.title, template: r.template, content: r.content, tenant_id: r.tenant_id });
        document.title = r.title;
      } else {
        setNotFound(true);
      }
    });
  }, [slug, isPreview]);

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

  const normalizeWhatsapp = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    return digits.startsWith("55") ? digits : `55${digits}`;
  };

  const whatsappNumber = data.content.contactWhatsapp?.trim();

  return (
    <div className={`min-h-screen ${wrapper.bg}`}>
      {sections
        .filter((s) => s.visible)
        .map((section) => {
          if (section.id === "quiz" && data.content.quiz?.enabled) {
            return (
              <QuizSection
                key="quiz"
                quiz={data.content.quiz}
                whatsappNumber={whatsappNumber}
                tenantId={data.tenant_id}
                variant={templateKey as any}
              />
            );
          }
          const Renderer = sectionRenderers[section.id];
          if (!Renderer) return null;
          return <Renderer key={section.id} content={data.content} />;
        })}
      <footer className={wrapper.footer}>{data.content.footerText}</footer>

      {/* Floating WhatsApp Button */}
      {whatsappNumber && (
        <a
          href={`https://wa.me/${normalizeWhatsapp(whatsappNumber)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-[#25D366] text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all"
          aria-label="Fale pelo WhatsApp"
        >
          <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </a>
      )}
    </div>
  );
};

export default LandingPagePublic;
