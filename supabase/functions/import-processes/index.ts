import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DATAJUD_ENDPOINTS: Record<string, string> = {
  TJRS_1G: "https://api-publica.datajud.cnj.jus.br/api_publica_tjrs/_search",
  TJRS_2G: "https://api-publica.datajud.cnj.jus.br/api_publica_tjrs/_search",
  TRF4_JFRS: "https://api-publica.datajud.cnj.jus.br/api_publica_trf4/_search",
  TRF4_JFSC: "https://api-publica.datajud.cnj.jus.br/api_publica_trf4/_search",
  TRF4_JFPR: "https://api-publica.datajud.cnj.jus.br/api_publica_trf4/_search",
  TST: "https://api-publica.datajud.cnj.jus.br/api_publica_tst/_search",
  TSE: "https://api-publica.datajud.cnj.jus.br/api_publica_tse/_search",
  STJ: "https://api-publica.datajud.cnj.jus.br/api_publica_stj/_search",
  STM: "https://api-publica.datajud.cnj.jus.br/api_publica_stm/_search",
  TRF1: "https://api-publica.datajud.cnj.jus.br/api_publica_trf1/_search",
  TRF2: "https://api-publica.datajud.cnj.jus.br/api_publica_trf2/_search",
  TRF3: "https://api-publica.datajud.cnj.jus.br/api_publica_trf3/_search",
  TRF4: "https://api-publica.datajud.cnj.jus.br/api_publica_trf4/_search",
  TRF5: "https://api-publica.datajud.cnj.jus.br/api_publica_trf5/_search",
  TRF6: "https://api-publica.datajud.cnj.jus.br/api_publica_trf6/_search",
  TRT1: "https://api-publica.datajud.cnj.jus.br/api_publica_trt1/_search",
  TRT2: "https://api-publica.datajud.cnj.jus.br/api_publica_trt2/_search",
  TRT3: "https://api-publica.datajud.cnj.jus.br/api_publica_trt3/_search",
  TRT4: "https://api-publica.datajud.cnj.jus.br/api_publica_trt4/_search",
  TRT5: "https://api-publica.datajud.cnj.jus.br/api_publica_trt5/_search",
  TRT6: "https://api-publica.datajud.cnj.jus.br/api_publica_trt6/_search",
  TRT7: "https://api-publica.datajud.cnj.jus.br/api_publica_trt7/_search",
  TRT8: "https://api-publica.datajud.cnj.jus.br/api_publica_trt8/_search",
  TRT9: "https://api-publica.datajud.cnj.jus.br/api_publica_trt9/_search",
  TRT10: "https://api-publica.datajud.cnj.jus.br/api_publica_trt10/_search",
  TRT11: "https://api-publica.datajud.cnj.jus.br/api_publica_trt11/_search",
  TRT12: "https://api-publica.datajud.cnj.jus.br/api_publica_trt12/_search",
  TRT13: "https://api-publica.datajud.cnj.jus.br/api_publica_trt13/_search",
  TRT14: "https://api-publica.datajud.cnj.jus.br/api_publica_trt14/_search",
  TRT15: "https://api-publica.datajud.cnj.jus.br/api_publica_trt15/_search",
  TRT16: "https://api-publica.datajud.cnj.jus.br/api_publica_trt16/_search",
  TRT17: "https://api-publica.datajud.cnj.jus.br/api_publica_trt17/_search",
  TRT18: "https://api-publica.datajud.cnj.jus.br/api_publica_trt18/_search",
  TRT19: "https://api-publica.datajud.cnj.jus.br/api_publica_trt19/_search",
  TRT20: "https://api-publica.datajud.cnj.jus.br/api_publica_trt20/_search",
  TRT21: "https://api-publica.datajud.cnj.jus.br/api_publica_trt21/_search",
  TRT22: "https://api-publica.datajud.cnj.jus.br/api_publica_trt22/_search",
  TRT23: "https://api-publica.datajud.cnj.jus.br/api_publica_trt23/_search",
  TRT24: "https://api-publica.datajud.cnj.jus.br/api_publica_trt24/_search",
};

interface ImportedProcess {
  process_number: string;
  source: string;
  subject: string | null;
  simple_status: string | null;
}

function getApiKey(): string {
  const raw = Deno.env.get("DATAJUD_API_KEY") || "";
  // Remove any "APIKey " prefix if user accidentally included it
  const cleaned = raw.replace(/^APIKey\s+/i, "").trim();
  return cleaned;
}

async function fetchProcessesFromDataJud(
  source: string,
  credentials: { login: string; password: string }
): Promise<ImportedProcess[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error("[import-processes] DATAJUD_API_KEY not configured");
    return [];
  }

  const endpoint = DATAJUD_ENDPOINTS[source];
  if (!endpoint) {
    console.error(`[import-processes] No DataJud endpoint for source: ${source}`);
    return [];
  }

  const oabNumber = credentials.login;
  console.log(`[import-processes] Querying DataJud for OAB ${oabNumber} at ${endpoint}`);
  console.log(`[import-processes] API Key (first 10 chars): ${apiKey.substring(0, 10)}...`);

  const allProcesses: ImportedProcess[] = [];
  let searchAfter: number[] | null = null;
  const pageSize = 100;

  while (true) {
    const body: Record<string, unknown> = {
      query: {
        multi_match: {
          query: oabNumber,
          fields: ["*"],
        },
      },
      size: pageSize,
      _source: ["numeroProcesso", "classe", "assuntos", "dataAjuizamento", "tribunal", "grau"],
      sort: [{ "@timestamp": { order: "asc" } }],
    };

    if (searchAfter) {
      body.search_after = searchAfter;
    }

    // The correct format per CNJ docs: "Authorization: APIKey <key>"
    const authHeader = `APIKey ${apiKey}`;
    console.log(`[import-processes] Auth header prefix: ${authHeader.substring(0, 20)}...`);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[import-processes] DataJud API error ${response.status}: ${text}`);
      break;
    }

    const data = await response.json();
    const hits = data?.hits?.hits || [];

    if (hits.length === 0) break;

    console.log(`[import-processes] Page returned ${hits.length} processes (total so far: ${allProcesses.length + hits.length})`);

    for (const hit of hits) {
      const src = hit._source;
      const assuntos = src.assuntos?.flat()?.map((a: Record<string, string>) => a.nome).filter(Boolean).join(", ") || null;
      allProcesses.push({
        process_number: src.numeroProcesso,
        source,
        subject: assuntos,
        simple_status: "Importado",
      });
    }

    const lastHit = hits[hits.length - 1];
    if (lastHit?.sort) {
      searchAfter = lastHit.sort;
    } else {
      break;
    }

    if (hits.length < pageSize) break;
  }

  console.log(`[import-processes] Total found: ${allProcesses.length} processes for OAB ${oabNumber}`);
  return allProcesses;
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
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
