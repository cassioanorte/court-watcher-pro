import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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
            content: "Você é um especialista em marketing jurídico no Brasil. Crie quizzes para landing pages de escritórios de advocacia que qualificam leads. As perguntas devem ser claras, em linguagem simples, e ajudar a identificar se a pessoa tem direito ao benefício/serviço. Sempre responda em português brasileiro.",
          },
          {
            role: "user",
            content: `Crie um quiz de qualificação de leads sobre o tema: "${topic}". O quiz deve ter 4-6 perguntas com 2-4 opções cada. Cada opção tem uma pontuação (0 = não qualifica, 1 = parcialmente qualifica, 2 = totalmente qualifica). Defina também um threshold (pontuação mínima) adequado para considerar o lead qualificado.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_quiz",
              description: "Gera um quiz de qualificação de leads para landing page jurídica",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Título atrativo do quiz (ex: 'Descubra se você tem direito ao Auxílio Maternidade')" },
                  subtitle: { type: "string", description: "Subtítulo explicativo curto" },
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", description: "ID único (usar formato q1, q2, etc)" },
                        question: { type: "string", description: "Texto da pergunta" },
                        options: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              label: { type: "string", description: "Texto da opção" },
                              score: { type: "number", description: "Pontuação (0, 1 ou 2)" },
                            },
                            required: ["label", "score"],
                            additionalProperties: false,
                          },
                        },
                      },
                      required: ["id", "question", "options"],
                      additionalProperties: false,
                    },
                  },
                  qualifyThreshold: { type: "number", description: "Pontuação mínima para qualificar" },
                  qualifiedMessage: { type: "string", description: "Mensagem para leads qualificados" },
                  qualifiedWhatsappMessage: { type: "string", description: "Mensagem pré-preenchida para WhatsApp" },
                  unqualifiedMessage: { type: "string", description: "Mensagem educada para leads não qualificados" },
                },
                required: ["title", "subtitle", "questions", "qualifyThreshold", "qualifiedMessage", "qualifiedWhatsappMessage", "unqualifiedMessage"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_quiz" } },
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
      return new Response(JSON.stringify({ error: "Erro ao gerar quiz" }), {
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

    const quiz = JSON.parse(toolCall.function.arguments);
    quiz.enabled = true;
    quiz.collectContactOnUnqualified = true;

    return new Response(JSON.stringify({ quiz }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-quiz error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
