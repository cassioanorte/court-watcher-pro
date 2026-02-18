const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Verify user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claims.claims.sub as string;

    // Get user's tenant
    const { data: profile } = await serviceClient
      .from('profiles').select('tenant_id').eq('user_id', userId).single();
    if (!profile) {
      return new Response(JSON.stringify({ error: 'Perfil não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const tenantId = profile.tenant_id;

    // Check AI credits
    const { data: tenant } = await serviceClient
      .from('tenants').select('ai_credits_limit, ai_credits_used').eq('id', tenantId).single();
    if (!tenant) {
      return new Response(JSON.stringify({ error: 'Escritório não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (tenant.ai_credits_limit <= 0) {
      return new Response(JSON.stringify({ error: 'Seu plano não inclui análise por IA. Entre em contato com o suporte.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (tenant.ai_credits_used >= tenant.ai_credits_limit) {
      return new Response(JSON.stringify({ error: 'Créditos de IA esgotados para este mês. Entre em contato com o suporte para ampliar.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { publication_id } = await req.json();
    if (!publication_id) {
      return new Response(JSON.stringify({ error: 'publication_id obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get publication
    const { data: pub } = await serviceClient
      .from('dje_publications')
      .select('*')
      .eq('id', publication_id)
      .eq('tenant_id', tenantId)
      .single();

    if (!pub) {
      return new Response(JSON.stringify({ error: 'Publicação não encontrada' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (pub.ai_analyzed_at) {
      return new Response(JSON.stringify({
        success: true,
        already_analyzed: true,
        summary: pub.ai_summary,
        deadlines: pub.ai_deadlines,
        next_steps: pub.ai_next_steps,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Call AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY não configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pubText = `Tipo: ${pub.publication_type || 'Não identificado'}
Processo: ${pub.process_number || 'Não informado'}
Título: ${pub.title}
Conteúdo: ${pub.content || 'Sem conteúdo'}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `Você é um assistente jurídico especializado em direito brasileiro. Analise a publicação/nota de expediente abaixo e retorne EXATAMENTE em formato JSON com as seguintes chaves:
- "resumo": Um resumo claro e objetivo em linguagem simples (máximo 3 frases) explicando o que aconteceu no processo. Evite jargão jurídico.
- "prazos": Liste quaisquer prazos mencionados ou implícitos (ex: "15 dias para manifestação"). Se não houver prazo explícito, infira com base no tipo de ato processual. Se não for possível inferir, escreva "Sem prazo identificado".
- "proximos_passos": Recomende de 1 a 3 ações práticas que o advogado deve tomar em resposta a esta publicação.

Responda APENAS com o JSON, sem texto adicional.`,
          },
          { role: 'user', content: pubText },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'analyze_publication',
              description: 'Analyze a legal publication and return structured data',
              parameters: {
                type: 'object',
                properties: {
                  resumo: { type: 'string', description: 'Resumo claro em linguagem simples' },
                  prazos: { type: 'string', description: 'Prazos identificados ou inferidos' },
                  proximos_passos: { type: 'string', description: 'Próximos passos recomendados' },
                },
                required: ['resumo', 'prazos', 'proximos_passos'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'analyze_publication' } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns segundos.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos de IA do sistema esgotados. Entre em contato com o suporte.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errText = await aiResponse.text();
      console.error('AI error:', status, errText);
      return new Response(JSON.stringify({ error: 'Erro ao processar análise de IA' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    let analysis = { resumo: '', prazos: '', proximos_passos: '' };

    // Parse tool call response
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        analysis = JSON.parse(toolCall.function.arguments);
      } catch {
        console.error('Failed to parse tool call arguments');
      }
    } else {
      // Fallback: try parsing content as JSON
      const content = aiData.choices?.[0]?.message?.content || '';
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) analysis = JSON.parse(jsonMatch[0]);
      } catch {
        analysis.resumo = content;
      }
    }

    // Save analysis
    await serviceClient
      .from('dje_publications')
      .update({
        ai_summary: analysis.resumo || null,
        ai_deadlines: analysis.prazos || null,
        ai_next_steps: analysis.proximos_passos || null,
        ai_analyzed_at: new Date().toISOString(),
      })
      .eq('id', publication_id);

    // Increment credits used
    await serviceClient
      .from('tenants')
      .update({ ai_credits_used: tenant.ai_credits_used + 1 })
      .eq('id', tenantId);

    return new Response(JSON.stringify({
      success: true,
      summary: analysis.resumo,
      deadlines: analysis.prazos,
      next_steps: analysis.proximos_passos,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
