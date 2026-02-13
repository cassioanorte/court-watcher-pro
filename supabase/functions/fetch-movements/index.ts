import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map source enum to eproc base URLs for public consultation
const SOURCE_URLS: Record<string, string> = {
  TJRS_1G: "https://www.tjrs.jus.br/site_php/consulta/verificacao.php",
  TJRS_2G: "https://www.tjrs.jus.br/site_php/consulta/verificacao.php",
  TRF4_JFRS: "https://consulta.trf4.jus.br/trf4/controlador.php",
  TRF4_JFSC: "https://consulta.trf4.jus.br/trf4/controlador.php",
  TRF4_JFPR: "https://consulta.trf4.jus.br/trf4/controlador.php",
};

interface Movement {
  title: string;
  details: string | null;
  occurred_at: string;
  source_label: string;
  source_raw: string | null;
}

// Simulated public consultation - in production, this would scrape or call the actual court API
async function fetchPublicMovements(
  processNumber: string,
  source: string
): Promise<Movement[]> {
  // Clean process number (remove dots, dashes)
  const cleanNumber = processNumber.replace(/[.\-\/]/g, "");

  // For now, this is a stub that simulates what a real integration would return
  // In production, this would:
  // 1. Call the CNJ DataJud API (public, no auth needed)
  // 2. Or scrape the eproc public consultation page
  // 3. Or use eproc REST API with credentials if available

  console.log(`[fetch-movements] Querying ${source} for process ${cleanNumber}`);

  // Return empty array - real movements would come from court API
  // This stub allows the full pipeline to work end-to-end
  return [];
}

function generateHash(caseId: string, title: string, occurredAt: string): string {
  const raw = `${caseId}:${title}:${occurredAt}`;
  // Simple hash - in production use crypto
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

    // If case_id provided, update single case; otherwise update all with automation enabled
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
        const movements = await fetchPublicMovements(c.process_number, c.source);

        for (const mov of movements) {
          const uniqueHash = generateHash(c.id, mov.title, mov.occurred_at);

          // Upsert - skip if hash already exists
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

        // Update last_checked_at
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
