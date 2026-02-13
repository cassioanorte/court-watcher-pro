import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map source enum to DataJud API endpoints
const DATAJUD_ENDPOINTS: Record<string, string> = {
  TJRS_1G: "https://api-publica.datajud.cnj.jus.br/api_publica_tjrs/_search",
  TJRS_2G: "https://api-publica.datajud.cnj.jus.br/api_publica_tjrs/_search",
  TRF4_JFRS: "https://api-publica.datajud.cnj.jus.br/api_publica_trf4/_search",
  TRF4_JFSC: "https://api-publica.datajud.cnj.jus.br/api_publica_trf4/_search",
  TRF4_JFPR: "https://api-publica.datajud.cnj.jus.br/api_publica_trf4/_search",
};

interface ImportedProcess {
  process_number: string;
  source: string;
  subject: string | null;
  simple_status: string | null;
}

// Search DataJud for processes linked to a lawyer's OAB number
async function fetchProcessesFromDataJud(
  source: string,
  credentials: { login: string; password: string }
): Promise<ImportedProcess[]> {
  const apiKey = Deno.env.get("DATAJUD_API_KEY");
  if (!apiKey) {
    console.error("[import-processes] DATAJUD_API_KEY not configured");
    return [];
  }

  const endpoint = DATAJUD_ENDPOINTS[source];
  if (!endpoint) {
    console.error(`[import-processes] No DataJud endpoint for source: ${source}`);
    return [];
  }

  // Use the OAB number (login) to search for processes where this lawyer is listed
  const oabNumber = credentials.login;
  console.log(`[import-processes] Querying DataJud for OAB ${oabNumber} at ${endpoint}`);

  // Search by lawyer name/OAB in the parties field
  const body = {
    query: {
      bool: {
        should: [
          { match: { "assuntos.nome": oabNumber } },
          {
            nested: {
              path: "movimentos",
              query: {
                match_all: {},
              },
            },
          },
        ],
        minimum_should_match: 0,
        filter: [
          {
            match: {
              "classe.nome": {
                query: oabNumber,
                operator: "or",
              },
            },
          },
        ],
      },
    },
    size: 100,
    _source: ["numeroProcesso", "classe", "assuntos", "dataAjuizamento", "tribunal", "grau"],
  };

  // Alternative: simpler search by text across all fields
  const simpleBody = {
    query: {
      multi_match: {
        query: oabNumber,
        fields: ["*"],
      },
    },
    size: 50,
    _source: ["numeroProcesso", "classe", "assuntos", "dataAjuizamento", "tribunal", "grau"],
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(simpleBody),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[import-processes] DataJud API error ${response.status}: ${text}`);
    return [];
  }

  const data = await response.json();
  const hits = data?.hits?.hits || [];

  console.log(`[import-processes] Found ${hits.length} processes for OAB ${oabNumber}`);

  return hits.map((hit: any) => {
    const src = hit._source;
    const assuntos = src.assuntos?.map((a: any) => a.nome).join(", ") || null;

    return {
      process_number: src.numeroProcesso,
      source,
      subject: assuntos,
      simple_status: "Importado",
    };
  });
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
    const processes = await fetchProcessesFromDataJud(source, credentials);

    let imported = 0;
    let skipped = 0;

    for (const proc of processes) {
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
