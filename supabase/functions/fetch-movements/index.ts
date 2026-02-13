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

interface Movement {
  title: string;
  details: string | null;
  occurred_at: string;
  source_label: string;
  source_raw: string | null;
}

async function fetchDataJudMovements(
  processNumber: string,
  source: string
): Promise<Movement[]> {
  const apiKey = Deno.env.get("DATAJUD_API_KEY");
  if (!apiKey) {
    console.error("[fetch-movements] DATAJUD_API_KEY not configured");
    return [];
  }

  const endpoint = DATAJUD_ENDPOINTS[source];
  if (!endpoint) {
    console.error(`[fetch-movements] No DataJud endpoint for source: ${source}`);
    return [];
  }

  // Clean process number - remove formatting but keep digits and dots as needed
  const cleanNumber = processNumber.replace(/[.\-\/]/g, "");

  console.log(`[fetch-movements] Querying DataJud for process ${cleanNumber} at ${endpoint}`);

  const body = {
    query: {
      match: {
        numeroProcesso: cleanNumber,
      },
    },
    size: 1,
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[fetch-movements] DataJud API error ${response.status}: ${text}`);
    return [];
  }

  const data = await response.json();
  const hits = data?.hits?.hits || [];

  if (hits.length === 0) {
    console.log(`[fetch-movements] No results found for process ${cleanNumber}`);
    return [];
  }

  const processo = hits[0]._source;
  const movimentos = processo?.movimentos || [];

  console.log(`[fetch-movements] Found ${movimentos.length} movements for process ${cleanNumber}`);

  return movimentos.map((mov: any) => ({
    title: mov.nome || mov.complemento || "Movimentação",
    details: mov.complemento || null,
    occurred_at: mov.dataHora || new Date().toISOString(),
    source_label: source,
    source_raw: JSON.stringify(mov),
  }));
}

function generateHash(caseId: string, title: string, occurredAt: string): string {
  const raw = `${caseId}:${title}:${occurredAt}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { case_id } = await req.json().catch(() => ({ case_id: null }));

    let casesQuery = supabase
      .from("cases")
      .select("id, process_number, source, tenant_id");

    if (case_id) {
      casesQuery = casesQuery.eq("id", case_id);
    } else {
      casesQuery = casesQuery.eq("automation_enabled", true);
    }

    const { data: cases, error: casesError } = await casesQuery;
    if (casesError) throw casesError;
    if (!cases || cases.length === 0) {
      return new Response(
        JSON.stringify({ message: "No cases to update", updated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalNew = 0;

    for (const c of cases) {
      try {
        const movements = await fetchDataJudMovements(c.process_number, c.source);

        for (const mov of movements) {
          const uniqueHash = generateHash(c.id, mov.title, mov.occurred_at);

          const { error: insertError } = await supabase
            .from("movements")
            .upsert(
              {
                case_id: c.id,
                title: mov.title,
                details: mov.details,
                occurred_at: mov.occurred_at,
                source_label: mov.source_label,
                source_raw: mov.source_raw,
                unique_hash: uniqueHash,
                is_manual: false,
              },
              { onConflict: "unique_hash", ignoreDuplicates: true }
            );

          if (!insertError) totalNew++;
        }

        await supabase
          .from("cases")
          .update({ last_checked_at: new Date().toISOString() })
          .eq("id", c.id);
      } catch (err) {
        console.error(`[fetch-movements] Error processing case ${c.id}:`, err);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Checked ${cases.length} case(s)`,
        cases_checked: cases.length,
        new_movements: totalNew,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[fetch-movements] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
