import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ParsedMovement {
  title: string;
  details: string | null;
  occurred_at: string;
}

function parseMovementsFromHtml(html: string): ParsedMovement[] {
  const movements: ParsedMovement[] = [];

  // Pattern 1: eproc table rows with trEvento IDs (most reliable)
  const trPattern = /<tr[^>]*id=["']?trEvento(\d+)["']?[^>]*>([\s\S]*?)<\/tr>/gi;
  const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  const stripTags = (s: string) =>
    s.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
     .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

  let trMatch;
  while ((trMatch = trPattern.exec(html)) !== null) {
    const evtNum = trMatch[1];
    const rowHtml = trMatch[2];
    const cells: string[] = [];
    let tdMatch;
    tdPattern.lastIndex = 0;
    while ((tdMatch = tdPattern.exec(rowHtml)) !== null) {
      cells.push(tdMatch[1]);
    }
    if (cells.length < 3) continue;

    const dateCell = stripTags(cells[1] || "");
    const descCell = stripTags(cells[2] || "");
    const datePat = /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)/;
    const dm = datePat.exec(dateCell);
    if (!dm) continue;

    const [d, m, y] = dm[1].split("/").map(Number);
    const [h, min] = dm[2].split(":").map(Number);
    if (y < 1990 || y > 2035 || m < 1 || m > 12) continue;

    const title = descCell.substring(0, 500);
    if (title.length < 2) continue;
    if (title.includes("carregarTooltip") || title.includes("infraTooltip") || title.includes("window.")) continue;

    movements.push({
      title: `Evento ${evtNum} - ${title}`,
      details: null,
      occurred_at: new Date(y, m - 1, d, h || 0, min || 0).toISOString(),
    });
  }

  if (movements.length > 0) return movements;

  // Pattern 2: fallback - extract event number + date + description from plain text
  const plainText = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

  const evtPat = /(\d{1,4})\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)\s+(.+?)(?=\d{1,4}\s+\d{2}\/\d{2}\/\d{4}|$)/g;
  let match;
  while ((match = evtPat.exec(plainText)) !== null) {
    const evtNum = match[1];
    const dateStr = match[2];
    const timeStr = match[3];
    const title = match[4].trim().substring(0, 500);
    if (title.length < 3) continue;
    if (title.includes("carregarTooltip") || title.includes("infraTooltip")) continue;

    const [d, m, y] = dateStr.split("/").map(Number);
    const [h, min] = timeStr.split(":").map(Number);
    if (y < 1990 || y > 2035 || m < 1 || m > 12) continue;

    movements.push({
      title: `Evento ${evtNum} - ${title}`,
      details: null,
      occurred_at: new Date(y, m - 1, d, h || 0, min || 0).toISOString(),
    });
  }

  // Pattern 3: simple date pattern without event number (last resort)
  if (movements.length === 0) {
    const simplePat = /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)\s+(.+?)(?=\d{2}\/\d{2}\/\d{4}|$)/g;
    while ((match = simplePat.exec(plainText)) !== null) {
      const dateStr = match[1];
      const timeStr = match[2];
      const title = match[3].trim().substring(0, 500);
      if (title.length < 3) continue;

      const [d, m, y] = dateStr.split("/").map(Number);
      const [h, min] = timeStr.split(":").map(Number);
      if (y < 1990 || y > 2035 || m < 1 || m > 12) continue;

      movements.push({
        title,
        details: null,
        occurred_at: new Date(y, m - 1, d, h || 0, min || 0).toISOString(),
      });
    }
  }

  return movements;
}

function extractProcessNumber(html: string): string | null {
  const text = html.replace(/<[^>]*>/g, " ");
  // CNJ format: NNNNNNN-DD.YYYY.J.TR.OOOO
  const cnjMatch = text.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
  if (cnjMatch) return cnjMatch[1];
  // Pure 20-digit
  const digitMatch = text.match(/(\d{20})/);
  if (digitMatch) {
    const d = digitMatch[1];
    return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16, 20)}`;
  }
  return null;
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
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { html, case_id, source_url } = await req.json();

    if (!html || typeof html !== "string" || html.length < 50) {
      return new Response(
        JSON.stringify({ success: false, error: "HTML inválido ou muito curto" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If case_id provided, use it directly. Otherwise try to match by process number.
    let targetCaseId = case_id;
    let targetCase: any = null;

    if (targetCaseId) {
      const { data } = await supabase.from("cases").select("id, process_number, source, tenant_id").eq("id", targetCaseId).single();
      targetCase = data;
    } else {
      // Try to find case by process number extracted from HTML
      const processNumber = extractProcessNumber(html);
      if (!processNumber) {
        return new Response(
          JSON.stringify({ success: false, error: "Não foi possível identificar o número do processo no HTML" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Search with and without formatting
      const digits = processNumber.replace(/\D/g, "");
      const { data } = await supabase
        .from("cases")
        .select("id, process_number, source, tenant_id")
        .or(`process_number.eq.${processNumber},process_number.eq.${digits}`)
        .limit(1)
        .single();
      targetCase = data;
    }

    if (!targetCase) {
      return new Response(
        JSON.stringify({ success: false, error: "Processo não encontrado no sistema" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const movements = parseMovementsFromHtml(html);
    console.log(`[capture-movements] Parsed ${movements.length} movements for case ${targetCase.id}`);

    let newCount = 0;
    for (const mov of movements) {
      const uniqueHash = generateHash(targetCase.id, mov.title, mov.occurred_at);
      const { error } = await supabase.from("movements").upsert(
        {
          case_id: targetCase.id,
          title: mov.title.substring(0, 500),
          details: mov.details,
          occurred_at: mov.occurred_at,
          source_label: source_url ? new URL(source_url).hostname : "Bookmarklet",
          source_raw: null,
          unique_hash: uniqueHash,
          is_manual: false,
        },
        { onConflict: "unique_hash", ignoreDuplicates: true }
      );
      if (!error) newCount++;
    }

    // Update last_checked_at
    await supabase.from("cases").update({ last_checked_at: new Date().toISOString() }).eq("id", targetCase.id);

    return new Response(
      JSON.stringify({
        success: true,
        case_id: targetCase.id,
        process_number: targetCase.process_number,
        total_parsed: movements.length,
        new_movements: newCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[capture-movements] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
