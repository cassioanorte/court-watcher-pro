import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Map process_source enum to DataJud API alias.
 * DataJud endpoint pattern: https://api-publica.datajud.cnj.jus.br/api_publica_{alias}/_search
 */
const SOURCE_TO_DATAJUD_ALIAS: Record<string, string> = {
  TJRS_1G: "tjrs",
  TJRS_2G: "tjrs",
  TRF4_JFRS: "trf4",
  TRF4_JFSC: "trf4",
  TRF4_JFPR: "trf4",
  TRF4: "trf4",
  TST: "tst",
  TSE: "tse",
  STJ: "stj",
  STM: "stm",
  TRF1: "trf1",
  TRF2: "trf2",
  TRF3: "trf3",
  TRF5: "trf5",
  TRF6: "trf6",
  TRT1: "trt1",
  TRT2: "trt2",
  TRT3: "trt3",
  TRT4: "trt4",
  TRT5: "trt5",
  TRT6: "trt6",
  TRT7: "trt7",
  TRT8: "trt8",
  TRT9: "trt9",
  TRT10: "trt10",
  TRT11: "trt11",
  TRT12: "trt12",
  TRT13: "trt13",
  TRT14: "trt14",
  TRT15: "trt15",
  TRT16: "trt16",
  TRT17: "trt17",
  TRT18: "trt18",
  TRT19: "trt19",
  TRT20: "trt20",
  TRT21: "trt21",
  TRT22: "trt22",
  TRT23: "trt23",
  TRT24: "trt24",
};

function formatCNJ(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 20 && !raw.includes("-")) {
    return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
  }
  return raw;
}

interface DataJudMovement {
  title: string;
  details: string | null;
  occurred_at: string;
  source_label: string;
  source_raw: string | null;
}

async function fetchFromDataJud(
  processNumber: string,
  source: string,
  apiKey: string
): Promise<DataJudMovement[]> {
  const alias = SOURCE_TO_DATAJUD_ALIAS[source];
  if (!alias) {
    console.warn(`[fetch-movements] No DataJud alias for source: ${source}`);
    return [];
  }

  const formatted = formatCNJ(processNumber);
  const digits = processNumber.replace(/\D/g, "");
  const url = `https://api-publica.datajud.cnj.jus.br/api_publica_${alias}/_search`;

  const body = {
    query: {
      bool: {
        should: [
          { match: { numeroProcesso: formatted } },
          { match: { numeroProcesso: digits } },
        ],
        minimum_should_match: 1,
      },
    },
    size: 1,
    _source: ["numeroProcesso", "movimentos", "classe", "assuntos", "orgaoJulgador"],
  };

  console.log(`[fetch-movements] DataJud query: ${url} for ${formatted}`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `APIKey ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[fetch-movements] DataJud error ${response.status}: ${errText}`);
      return [];
    }

    const data = await response.json();
    const hits = data?.hits?.hits || [];

    if (hits.length === 0) {
      console.log(`[fetch-movements] No results from DataJud for ${formatted}`);
      return [];
    }

    const proc = hits[0]._source;
    const movimentos = proc?.movimentos || [];

    console.log(`[fetch-movements] DataJud returned ${movimentos.length} movements for ${formatted}`);

    return movimentos.map((mov: any) => {
      const nome = mov.nome || mov.descricao || "Movimentação";
      const complementos = (mov.complementosTabelados || [])
        .map((c: any) => c.descricao || c.nome)
        .filter(Boolean)
        .join("; ");

      const dataHora = mov.dataHora || new Date().toISOString();

      return {
        title: nome,
        details: complementos || null,
        occurred_at: dataHora,
        source_label: `DataJud/${alias.toUpperCase()}`,
        source_raw: JSON.stringify(mov),
      };
    });
  } catch (err) {
    console.error(`[fetch-movements] DataJud fetch error:`, err);
    return [];
  }
}

function generateHash(caseId: string, title: string, occurredAt: string): string {
  const raw = `${caseId}:${title}:${occurredAt}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
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
    const datajudApiKey = Deno.env.get("DATAJUD_API_KEY");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (!datajudApiKey) {
      return new Response(
        JSON.stringify({ error: "DATAJUD_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { case_id } = await req.json().catch(() => ({ case_id: null }));

    let casesQuery = supabase
      .from("cases")
      .select("id, process_number, source, tenant_id")
      .eq("archived", false);

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

    console.log(`[fetch-movements] Processing ${cases.length} case(s)`);

    let totalNew = 0;
    const errors: string[] = [];
    const BATCH_SIZE = 50;

    for (const c of cases) {
      try {
        const movements = await fetchFromDataJud(c.process_number, c.source, datajudApiKey);

        if (movements.length === 0) continue;

        // Batch upsert movements
        const records = movements.map((mov) => ({
          case_id: c.id,
          title: mov.title.substring(0, 500),
          details: mov.details,
          occurred_at: mov.occurred_at,
          source_label: mov.source_label,
          source_raw: mov.source_raw,
          unique_hash: generateHash(c.id, mov.title, mov.occurred_at),
          is_manual: false,
        }));

        for (let i = 0; i < records.length; i += BATCH_SIZE) {
          const batch = records.slice(i, i + BATCH_SIZE);
          const { error: insertError } = await supabase
            .from("movements")
            .upsert(batch, { onConflict: "unique_hash", ignoreDuplicates: true });

          if (insertError) {
            console.error(`[fetch-movements] Upsert error for case ${c.id}:`, insertError);
          } else {
            totalNew += batch.length;
          }
        }

        await supabase
          .from("cases")
          .update({ last_checked_at: new Date().toISOString() })
          .eq("id", c.id);

        // Small delay between API calls to respect rate limits
        if (cases.length > 1) {
          await new Promise((r) => setTimeout(r, 500));
        }
      } catch (err) {
        const msg = `Case ${c.id}: ${(err as Error).message}`;
        console.error(`[fetch-movements] ${msg}`);
        errors.push(msg);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Checked ${cases.length} case(s)`,
        cases_checked: cases.length,
        new_movements: totalNew,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[fetch-movements] Error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
