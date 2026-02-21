import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, file_name } = await req.json();

    if (!text || text.trim().length < 20) {
      return new Response(JSON.stringify({ error: "Texto insuficiente para análise" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `Você é um assistente jurídico especializado em extrair dados financeiros de documentos de RPV (Requisição de Pequeno Valor) e Precatórios do sistema judiciário brasileiro.

Analise o texto fornecido e extraia as seguintes informações. Retorne APENAS os dados encontrados. Se um campo não for encontrado, retorne null.

IMPORTANTE:
- Valores monetários devem ser números decimais (ex: 15234.56)
- Percentuais devem ser números decimais (ex: 20 para 20%)
- Datas no formato YYYY-MM-DD
- O tipo deve ser "rpv" ou "precatorio"`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analise este documento (${file_name || "documento"}):\n\n${text}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_payment_data",
              description: "Extrair dados financeiros de RPV ou Precatório",
              parameters: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["rpv", "precatorio"], description: "Tipo do documento" },
                  gross_amount: { type: "number", description: "Valor bruto total em reais" },
                  office_fees_percent: { type: "number", description: "Percentual de honorários advocatícios" },
                  office_amount: { type: "number", description: "Valor dos honorários do escritório em reais" },
                  client_amount: { type: "number", description: "Valor líquido do cliente em reais" },
                  court_costs: { type: "number", description: "Custas judiciais em reais" },
                  social_security: { type: "number", description: "Contribuição previdenciária em reais" },
                  income_tax: { type: "number", description: "Imposto de renda retido na fonte em reais" },
                  beneficiary_name: { type: "string", description: "Nome do beneficiário/autor" },
                  beneficiary_cpf: { type: "string", description: "CPF do beneficiário" },
                  process_number: { type: "string", description: "Número do processo (formato CNJ)" },
                  court: { type: "string", description: "Vara ou tribunal" },
                  entity: { type: "string", description: "Entidade devedora (INSS, União, Município, etc.)" },
                  reference_date: { type: "string", description: "Data base do cálculo (YYYY-MM-DD)" },
                  expected_payment_date: { type: "string", description: "Data prevista de pagamento (YYYY-MM-DD)" },
                },
                required: ["type"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_payment_data" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      return new Response(JSON.stringify({ error: "Erro ao processar com IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "IA não conseguiu extrair dados do documento" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let extracted;
    try {
      extracted = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } catch {
      return new Response(JSON.stringify({ error: "Erro ao parsear resposta da IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auto-calculate missing fields
    if (extracted.gross_amount && extracted.office_fees_percent && !extracted.office_amount) {
      extracted.office_amount = Math.round(extracted.gross_amount * extracted.office_fees_percent / 100 * 100) / 100;
    }
    if (extracted.gross_amount && extracted.office_amount && !extracted.client_amount) {
      const deductions = (extracted.court_costs || 0) + (extracted.social_security || 0) + (extracted.income_tax || 0);
      extracted.client_amount = Math.round((extracted.gross_amount - extracted.office_amount - deductions) * 100) / 100;
    }

    return new Response(JSON.stringify({ data: extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-payment-data error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
