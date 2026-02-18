import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { tenant_id, name, phone, email, quiz_answers, quiz_score, qualified, quiz_title } = await req.json();

    if (!tenant_id || !name || !phone) {
      return new Response(JSON.stringify({ error: "tenant_id, name e phone são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { error } = await supabase.from("crm_leads").insert({
      tenant_id,
      name: name.substring(0, 200),
      phone: phone.substring(0, 30),
      email: email ? email.substring(0, 255) : null,
      origin: `Quiz: ${(quiz_title || "Landing Page").substring(0, 100)}`,
      notes: `Respostas do quiz: ${JSON.stringify(quiz_answers)}\nPontuação: ${quiz_score}\nQualificado: ${qualified ? "Sim" : "Não"}`,
      stage: "contato_inicial",
    });

    if (error) {
      console.error("Error saving quiz lead:", error);
      return new Response(JSON.stringify({ error: "Erro ao salvar lead" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("save-quiz-lead error:", e);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
