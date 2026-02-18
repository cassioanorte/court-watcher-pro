import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { officeName, areaOfPractice, description, phone, email, address, whatsapp, website } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const prompt = `Gere o conteúdo completo para uma landing page de um escritório de advocacia com as seguintes informações:

Nome do escritório: ${officeName || "Escritório de Advocacia"}
Áreas de atuação: ${areaOfPractice || "Diversas áreas do direito"}
Descrição: ${description || "Escritório especializado"}
Telefone: ${phone || ""}
Email: ${email || ""}
Endereço: ${address || ""}
WhatsApp: ${whatsapp || ""}
Website: ${website || ""}

Retorne APENAS o JSON no formato abaixo, sem explicações adicionais. O conteúdo deve ser profissional, persuasivo e em português brasileiro:`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "Você é um especialista em marketing jurídico e criação de landing pages para escritórios de advocacia no Brasil. Sempre responda em português brasileiro."
          },
          { role: "user", content: prompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_landing_page",
              description: "Gera o conteúdo estruturado para uma landing page de escritório de advocacia",
              parameters: {
                type: "object",
                properties: {
                  heroTitle: { type: "string", description: "Título principal da landing page (máx 60 chars)" },
                  heroSubtitle: { type: "string", description: "Subtítulo persuasivo (máx 120 chars)" },
                  heroCtaText: { type: "string", description: "Texto do botão CTA (ex: Fale Conosco)" },
                  heroCtaLink: { type: "string", description: "Link do CTA (usar #contato)" },
                  aboutTitle: { type: "string", description: "Título da seção sobre" },
                  aboutText: { type: "string", description: "Texto descritivo sobre o escritório (2-3 parágrafos)" },
                  services: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" }
                      },
                      required: ["title", "description"]
                    },
                    description: "Lista de 3-5 serviços/áreas de atuação"
                  },
                  testimonials: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        text: { type: "string" }
                      },
                      required: ["name", "text"]
                    },
                    description: "Lista de 2-3 depoimentos fictícios realistas"
                  },
                  contactTitle: { type: "string" },
                  contactPhone: { type: "string" },
                  contactEmail: { type: "string" },
                  contactAddress: { type: "string" },
                  footerText: { type: "string" }
                },
                required: ["heroTitle", "heroSubtitle", "heroCtaText", "heroCtaLink", "aboutTitle", "aboutText", "services", "testimonials", "contactTitle", "footerText"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "generate_landing_page" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro ao gerar conteúdo" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "Resposta inesperada da IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const content = JSON.parse(toolCall.function.arguments);
    
    // Fill in contact info from user input if AI didn't
    if (phone && !content.contactPhone) content.contactPhone = phone;
    if (email && !content.contactEmail) content.contactEmail = email;
    if (address && !content.contactAddress) content.contactAddress = address;

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-landing-page error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
