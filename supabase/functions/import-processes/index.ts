import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ImportedProcess {
  process_number: string;
  source: string;
  subject: string | null;
  simple_status: string | null;
}

// Stub: In production, this queries the eproc API with the lawyer's credentials
// to list all processes linked to their OAB number
async function fetchProcessesFromTribunal(
  source: string,
  credentials: { login: string; password: string }
): Promise<ImportedProcess[]> {
  console.log(`[import-processes] Querying ${source} with login ${credentials.login}`);
  
  // This is a stub - replace with actual eproc API integration
  // The eproc API endpoint would be something like:
  // TJRS: https://eproc1g.tjrs.jus.br/eproc/externo_controlador.php?acao=processo_consultar
  // TRF4: https://eproc.trf4.jus.br/eproc/externo_controlador.php?acao=processo_consultar
  
  // Return empty array - real processes would come from court API
  return [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { tenant_id, source } = await req.json();

    if (!tenant_id || !source) {
      return new Response(
        JSON.stringify({ error: "tenant_id and source are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get credentials for this tenant + source
    const { data: credData, error: credError } = await supabase
      .from("eproc_credentials")
      .select("encrypted_credentials")
      .eq("tenant_id", tenant_id)
      .eq("source", source)
      .single();

    if (credError || !credData?.encrypted_credentials) {
      return new Response(
        JSON.stringify({ error: "Credenciais não encontradas para este tribunal." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const credentials = JSON.parse(credData.encrypted_credentials);
    const processes = await fetchProcessesFromTribunal(source, credentials);

    let imported = 0;
    let skipped = 0;

    for (const proc of processes) {
      // Check if process already exists for this tenant
      const { data: existing } = await supabase
        .from("cases")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("process_number", proc.process_number)
        .single();

      if (existing) {
        skipped++;
        continue;
      }

      const { error: insertError } = await supabase.from("cases").insert({
        tenant_id,
        process_number: proc.process_number,
        source: proc.source,
        subject: proc.subject,
        simple_status: proc.simple_status || "Importado",
        automation_enabled: true,
      });

      if (!insertError) imported++;
    }

    return new Response(
      JSON.stringify({
        message: `Importação concluída`,
        imported,
        skipped,
        total_found: processes.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[import-processes] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
