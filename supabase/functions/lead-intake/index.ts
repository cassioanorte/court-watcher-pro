import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    // Validate required fields
    const { tenant_id, name } = body;
    if (!tenant_id || typeof tenant_id !== "string") {
      return new Response(JSON.stringify({ error: "tenant_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return new Response(JSON.stringify({ error: "name é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate tenant exists
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id")
      .eq("id", tenant_id)
      .single();

    if (tenantError || !tenant) {
      return new Response(JSON.stringify({ error: "Tenant não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sanitize and validate optional fields
    const sanitize = (val: unknown, maxLen = 255): string | null => {
      if (!val || typeof val !== "string") return null;
      return val.trim().slice(0, maxLen) || null;
    };

    const email = sanitize(body.email);
    const phone = sanitize(body.phone, 30);
    const cpf = sanitize(body.cpf, 20);
    const company = sanitize(body.company);
    const origin = sanitize(body.origin, 50);
    const notes = sanitize(body.notes, 2000);
    const estimated_value = typeof body.estimated_value === "number" ? Math.max(0, body.estimated_value) : 0;

    // Insert the lead
    const { data: lead, error: insertError } = await supabase
      .from("crm_leads")
      .insert({
        tenant_id,
        name: name.trim().slice(0, 255),
        email,
        phone,
        cpf,
        company,
        origin,
        notes,
        estimated_value,
        stage: "contato_inicial",
      })
      .select("id, name, stage, created_at")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Erro ao criar lead" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, lead }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Lead intake error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
