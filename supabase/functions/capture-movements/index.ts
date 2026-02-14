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

  // TRF4 eproc pattern: dates followed by movement descriptions
  // Pattern 1: DD/MM/YYYY HH:MM:SS - Title
  const dateLinePattern = /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)\s*[-–|]\s*(.+?)(?:<|$)/gm;
  let match;
  while ((match = dateLinePattern.exec(html)) !== null) {
    const [, dateStr, timeStr, title] = match;
    const cleaned = title.replace(/<[^>]*>/g, "").trim();
    if (cleaned.length < 3) continue;
    const [d, m, y] = dateStr.split("/").map(Number);
    const [h, min] = timeStr.split(":").map(Number);
    if (y < 1990 || y > 2030 || m < 1 || m > 12) continue;
    movements.push({
      title: cleaned,
      details: null,
      occurred_at: new Date(y, m - 1, d, h || 0, min || 0).toISOString(),
    });
  }

  // Pattern 2: table rows with date cells (common in eproc/TJRS)
  const rowPattern = /<tr[^>]*>[\s\S]*?<td[^>]*>[\s\S]*?(\d{2}\/\d{2}\/\d{4})[\s\S]*?<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi;
  while ((match = rowPattern.exec(html)) !== null) {
    const dateStr = match[1];
    const content = match[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (content.length < 3) continue;
    const [d, m, y] = dateStr.split("/").map(Number);
    if (y < 1990 || y > 2030 || m < 1 || m > 12) continue;
    // Avoid duplicates
    const iso = new Date(y, m - 1, d).toISOString();
    if (!movements.some((mv) => mv.title === content && mv.occurred_at === iso)) {
      movements.push({ title: content, details: null, occurred_at: iso });
    }
  }

  // Pattern 3: plain text DD/MM/YYYY - Title (from stripped text)
  const plainText = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
  const plainPattern = /(\d{2}\/\d{2}\/\d{4})\s*[-–|:]\s*(.+?)(?=\d{2}\/\d{2}\/\d{4}|$)/g;
  while ((match = plainPattern.exec(plainText)) !== null) {
    const dateStr = match[1];
    const title = match[2].trim().substring(0, 500);
    if (title.length < 3) continue;
    const [d, m, y] = dateStr.split("/").map(Number);
    if (y < 1990 || y > 2030 || m < 1 || m > 12) continue;
    const iso = new Date(y, m - 1, d).toISOString();
    if (!movements.some((mv) => mv.title === title && mv.occurred_at === iso)) {
      movements.push({ title, details: null, occurred_at: iso });
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
