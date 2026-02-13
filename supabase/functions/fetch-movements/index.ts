import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map source to public consultation URLs
const CONSULTATION_URLS: Record<string, (processNumber: string) => string> = {
  TRF4_JFRS: (n) => `https://consulta.trf4.jus.br/trf4/controlador.php?acao=consulta_processual_resultado_pesquisa&txtValor=${encodeURIComponent(n)}&selOrigem=RS&chkMostrarBaixados=&txtDataFase=`,
  TRF4_JFSC: (n) => `https://consulta.trf4.jus.br/trf4/controlador.php?acao=consulta_processual_resultado_pesquisa&txtValor=${encodeURIComponent(n)}&selOrigem=SC&chkMostrarBaixados=&txtDataFase=`,
  TRF4_JFPR: (n) => `https://consulta.trf4.jus.br/trf4/controlador.php?acao=consulta_processual_resultado_pesquisa&txtValor=${encodeURIComponent(n)}&selOrigem=PR&chkMostrarBaixados=&txtDataFase=`,
  TRF4: (n) => `https://consulta.trf4.jus.br/trf4/controlador.php?acao=consulta_processual_resultado_pesquisa&txtValor=${encodeURIComponent(n)}&selOrigem=TRF&chkMostrarBaixados=&txtDataFase=`,
  TJRS_1G: (n) => `https://www.tjrs.jus.br/novo/busca/?return=proc&client=wp_index&proxystylesheet=wp_index&aba=processos&q=${encodeURIComponent(n)}`,
  TJRS_2G: (n) => `https://www.tjrs.jus.br/novo/busca/?return=proc&client=wp_index&proxystylesheet=wp_index&aba=processos&q=${encodeURIComponent(n)}`,
};

function getFallbackUrl(processNumber: string): string {
  return `https://www.jusbrasil.com.br/consulta-processual/busca?q=${encodeURIComponent(processNumber)}`;
}

interface Movement {
  title: string;
  details: string | null;
  occurred_at: string;
  source_label: string;
  source_raw: string | null;
}

function formatProcessNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 20 && !raw.includes("-")) {
    return `${digits.slice(0,7)}-${digits.slice(7,9)}.${digits.slice(9,13)}.${digits.slice(13,14)}.${digits.slice(14,16)}.${digits.slice(16,20)}`;
  }
  return raw;
}

async function scrapeMovementsWithFirecrawl(
  processNumber: string,
  source: string
): Promise<Movement[]> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) {
    console.error("[fetch-movements] FIRECRAWL_API_KEY not configured");
    return [];
  }

  // Try both raw and formatted process number
  const formatted = formatProcessNumber(processNumber);
  const urlBuilder = CONSULTATION_URLS[source];
  
  // Try formatted first, then raw
  const urlsToTry = urlBuilder 
    ? [urlBuilder(formatted), urlBuilder(processNumber)]
    : [getFallbackUrl(formatted)];

  for (const consultUrl of urlsToTry) {
    console.log(`[fetch-movements] Scraping: ${consultUrl}`);
    
    const movements = await doScrape(consultUrl, source, apiKey);
    if (movements.length > 0) return movements;
  }

  return [];
}

async function doScrape(url: string, source: string, apiKey: string): Promise<Movement[]> {
  try {
    // Step 1: Scrape with markdown
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        waitFor: 1000,
        onlyMainContent: true,
        timeout: 15000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[fetch-movements] Firecrawl error ${response.status}: ${errText}`);
      return [];
    }

    const data = await response.json();
    const markdown = data?.data?.markdown || data?.markdown || "";

    if (!markdown || markdown.length < 50) {
      console.log(`[fetch-movements] No useful content (${markdown.length} chars)`);
      return [];
    }

    console.log(`[fetch-movements] Got ${markdown.length} chars of markdown`);

    // Parse movements from markdown
    const movements = parseMovementsFromMarkdown(markdown, source);
    
    if (movements.length > 0) {
      console.log(`[fetch-movements] Parsed ${movements.length} movements from markdown`);
      return movements;
    }

    // If regex didn't find anything, try AI extraction
    console.log("[fetch-movements] Regex found nothing, trying extract endpoint...");
    return await extractWithAI(url, source, apiKey);
  } catch (err) {
    console.error(`[fetch-movements] Scrape error:`, err);
    return [];
  }
}

async function extractWithAI(url: string, source: string, apiKey: string): Promise<Movement[]> {
  try {
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["extract"],
        extract: {
          prompt: "Extract all court movements (movimentações processuais) from this page. Each movement has a date and a title/description.",
          schema: {
            type: "object",
            properties: {
              movements: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    date: { type: "string", description: "Date in DD/MM/YYYY or ISO format" },
                    title: { type: "string", description: "Movement title/name" },
                    details: { type: "string", description: "Additional details" },
                  },
                  required: ["date", "title"],
                },
              },
            },
            required: ["movements"],
          },
        },
        waitFor: 1000,
        timeout: 15000,
      }),
    });

    if (!response.ok) {
      console.error(`[fetch-movements] Extract API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const extracted = data?.data?.extract || data?.extract || {};
    const movements = extracted?.movements || [];

    console.log(`[fetch-movements] AI extracted ${movements.length} movements`);

    return movements.map((mov: any) => {
      let occurredAt = mov.date || new Date().toISOString();
      // Parse DD/MM/YYYY to ISO if needed
      const brMatch = occurredAt.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      if (brMatch) {
        const [, d, m, y] = brMatch;
        occurredAt = new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toISOString();
      }

      return {
        title: mov.title || "Movimentação",
        details: mov.details || null,
        occurred_at: occurredAt,
        source_label: source,
        source_raw: JSON.stringify(mov),
      };
    });
  } catch (err) {
    console.error(`[fetch-movements] Extract error:`, err);
    return [];
  }
}

function parseMovementsFromMarkdown(markdown: string, source: string): Movement[] {
  const movements: Movement[] = [];

  // Pattern: DD/MM/YYYY [HH:MM] - Title
  const datePattern = /(\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2}(?::\d{2})?)?)\s*[-–|]\s*(.+?)(?:\n|$)/g;

  let match;
  while ((match = datePattern.exec(markdown)) !== null) {
    const dateStr = match[1].trim();
    const title = match[2].trim();

    if (title.length < 3) continue;

    const parts = dateStr.split(/[\s/:]/).map(Number);
    const day = parts[0], month = parts[1], year = parts[2];
    const hour = parts[3] || 0, min = parts[4] || 0;

    if (year < 1990 || year > 2030 || month < 1 || month > 12 || day < 1 || day > 31) continue;

    const isoDate = new Date(year, month - 1, day, hour, min).toISOString();

    movements.push({
      title,
      details: null,
      occurred_at: isoDate,
      source_label: source,
      source_raw: match[0],
    });
  }

  return movements;
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
        const movements = await scrapeMovementsWithFirecrawl(c.process_number, c.source);

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
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
