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
  const raw = Deno.env.get("DATAJUD_API_KEY") || "";
  const apiKey = raw.replace(/^APIKey\s+/i, "").trim();
  if (!apiKey) {
    console.error("[fetch-movements] DATAJUD_API_KEY not configured");
    return [];
  }

  const endpoint = DATAJUD_ENDPOINTS[source];
  if (!endpoint) {
    console.error(`[fetch-movements] No DataJud endpoint for source: ${source}`);
    return [];
  }

  // Try both formatted and raw number
  const digits = processNumber.replace(/\D/g, "");
  let formattedNumber = processNumber;
  if (digits.length === 20 && !processNumber.includes("-")) {
    formattedNumber = `${digits.slice(0,7)}-${digits.slice(7,9)}.${digits.slice(9,13)}.${digits.slice(13,14)}.${digits.slice(14,16)}.${digits.slice(16,20)}`;
  }

  // DataJud docs say to use "match" with the raw number (no formatting)
  // But some tribunals index with formatting - try raw digits first
  const queryNumber = digits;
  console.log(`[fetch-movements] Trying raw digits: "${queryNumber}" and formatted: "${formattedNumber}" at ${endpoint}`);

  // First try with raw digits
  let body: Record<string, unknown> = {
    query: {
      match: {
        numeroProcesso: queryNumber,
      },
    },
    size: 1,
  };

  let response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `APIKey ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[fetch-movements] DataJud API error ${response.status}: ${text}`);
    return [];
  }

  let data = await response.json();
  let totalHits = data?.hits?.total?.value ?? 0;
  console.log(`[fetch-movements] Raw digits query hits: ${totalHits}`);

  // If no results with raw digits, retry with formatted CNJ number
  if (totalHits === 0 && formattedNumber !== queryNumber) {
    console.log(`[fetch-movements] Retrying with formatted number: "${formattedNumber}"`);
    body = {
      query: { match: { numeroProcesso: formattedNumber } },
      size: 1,
    };
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `APIKey ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (response.ok) {
      data = await response.json();
      totalHits = data?.hits?.total?.value ?? 0;
      console.log(`[fetch-movements] Formatted query hits: ${totalHits}`);
    }
  }

  const hits = data?.hits?.hits || [];

  if (hits.length === 0) {
    console.log(`[fetch-movements] No results for "${formattedNumber}". Process may not be indexed by DataJud yet.`);
    return [];
  }

  const processo = hits[0]._source;
  const movimentos = processo?.movimentos || [];

  console.log(`[fetch-movements] Found ${movimentos.length} movements`);

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
