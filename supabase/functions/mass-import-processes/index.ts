import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ParsedProcess {
  process_number: string;
  author: string | null;
  defendant: string | null;
  subject: string | null;
}

/** Legal/procedural terms that should NEVER be treated as party names */
const NOISE_PATTERNS = [
  /^direito\b/i, /^procedimento\b/i, /^cumprimento\b/i, /^execução\b/i,
  /^incidente\b/i, /^liquidação\b/i, /^recurso\b/i, /^tutela\b/i,
  /^mandado\b/i, /^embargos\b/i, /^ação\b/i, /^agravo\b/i, /^apelação\b/i,
  /^matérias?\b/i, /^outras\b/i, /^ao\s+t[jrf]/i,
  /\bmovimento\b/i, /\bsusp$/i, /\bjuntada\b/i, /\bsentença\b/i,
  /\bdespacho\b/i, /\bpetição\b/i, /\bdecisão\b/i, /\bacórdão\b/i,
  /\bdistribuição\b/i, /\bconclusão\b/i, /\bintimação\b/i, /\bcitação\b/i,
  /^usucapião$/i, /^inventário$/i, /^divórcio$/i, /^interdição$/i,
  /^olada\b/i, /^em recupera/i, /^recuperação/i, /^classe\b/i,
  /^assunto\b/i, /^competência\b/i, /^situação\b/i, /^status\b/i,
  /^vara\b/i, /^comarca\b/i, /^juiz\b/i, /^juízo\b/i,
  /^tribunal\b/i, /^seção\b/i, /^turma\b/i, /^câmara\b/i,
];

function isNoise(name: string): boolean {
  const t = name.trim();
  if (t.length < 4) return true;
  if (/^\d/.test(t)) return true;
  if (t.split(/\s+/).filter(w => w.length > 1).length < 2) return true;
  if (!/[a-zA-ZÀ-ú]/.test(t)) return true;
  return NOISE_PATTERNS.some(p => p.test(t));
}

function cleanName(raw: string): string {
  let n = raw.replace(/\s+/g, " ").trim();
  n = n.replace(/^[,;:\-–—.]+|[,;:\-–—.]+$/g, "").trim();
  if (n.length < 4 || n.length > 200) return "";
  if (isNoise(n)) return "";
  return n;
}

/**
 * Extract author and defendant from text between two process numbers.
 * Looks for labeled patterns first (Autor:, Réu:), then falls back to "X vs Y" style.
 */
function extractParties(context: string): { author: string | null; defendant: string | null } {
  let author: string | null = null;
  let defendant: string | null = null;

  // Pattern 1: Labeled — Autor/Requerente/Exequente/Reclamante
  const authorPatterns = /(?:Autor|Autora|Requerente|Exequente|Reclamante|Impetrante|Apelante|Agravante|Embargante|Recorrente)\s*:\s*([^\n|<]{3,100})/i;
  const defPatterns = /(?:Réu|Ré|Requerido|Requerida|Executado|Executada|Reclamado|Reclamada|Impetrado|Impetrada|Apelado|Apelada|Agravado|Agravada|Embargado|Embargada|Recorrido|Recorrida)\s*:\s*([^\n|<]{3,100})/i;

  const am = context.match(authorPatterns);
  if (am) {
    const cleaned = cleanName(am[1]);
    if (cleaned) author = cleaned;
  }

  const dm = context.match(defPatterns);
  if (dm) {
    const cleaned = cleanName(dm[1]);
    if (cleaned) defendant = cleaned;
  }

  if (author || defendant) return { author, defendant };

  // Pattern 2: "NOME1 x NOME2" or "NOME1 X NOME2"
  const vsMatch = context.match(/([A-ZÀ-Ú][A-ZÀ-Ú\s.]{4,80}?)\s+(?:x|X|vs\.?)\s+([A-ZÀ-Ú][A-ZÀ-Ú\s.]{4,80}?)(?:\s*[-–—\n|<]|$)/);
  if (vsMatch) {
    const a = cleanName(vsMatch[1]);
    const d = cleanName(vsMatch[2]);
    if (a) author = a;
    if (d) defendant = d;
  }

  return { author, defendant };
}

function parseSearchResults(html: string): ParsedProcess[] {
  const processes: ParsedProcess[] = [];
  const seen = new Set<string>();

  // Strip HTML tags to get plain text
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:div|td|tr|li|p|span|h\d)>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ");

  // Find all CNJ-format process numbers and their positions
  const cnjPattern = /(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/g;
  const matches: { num: string; index: number }[] = [];
  let match;

  while ((match = cnjPattern.exec(text)) !== null) {
    if (!seen.has(match[1])) {
      seen.add(match[1]);
      matches.push({ num: match[1], index: match.index });
    }
  }

  // For each process, extract context ONLY up to the next process number
  for (let i = 0; i < matches.length; i++) {
    const startIdx = matches[i].index;
    const endIdx = i + 1 < matches.length
      ? matches[i + 1].index  // stop at next process
      : Math.min(text.length, startIdx + 800);  // last process: max 800 chars

    const context = text.substring(startIdx, endIdx);
    const { author, defendant } = extractParties(context);

    let subject: string | null = null;
    const subjectMatch = context.match(/(?:Classe|Assunto|Ação|Competência)\s*:\s*([^,\n|]{3,200})/i);
    if (subjectMatch) subject = subjectMatch[1].trim().substring(0, 200);

    processes.push({
      process_number: matches[i].num,
      author,
      defendant,
      subject,
    });
  }

  // Also try pure 20-digit numbers
  const digitPattern = /(?<!\d)(\d{20})(?!\d)/g;
  while ((match = digitPattern.exec(text)) !== null) {
    const d = match[1];
    const formatted = `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16, 20)}`;
    if (!seen.has(formatted)) {
      seen.add(formatted);
      processes.push({ process_number: formatted, author: null, defendant: null, subject: null });
    }
  }

  return processes;
}

function inferSource(processNumber: string): string {
  const digits = processNumber.replace(/\D/g, "");
  if (digits.length < 20) return "TRF4_JFRS";
  const justice = digits[13];
  const tribunal = digits.slice(14, 16);
  if (justice === "4") {
    const origin = digits.slice(16, 20);
    if (origin.startsWith("71") || origin.startsWith("50")) return "TRF4_JFRS";
    if (origin.startsWith("72")) return "TRF4_JFSC";
    if (origin.startsWith("70")) return "TRF4_JFPR";
    return "TRF4";
  }
  if (justice === "8" && tribunal === "21") return "TJRS_1G";
  if (justice === "5") {
    const trtMap: Record<string, string> = {
      "01": "TRT1", "02": "TRT2", "03": "TRT3", "04": "TRT4",
      "05": "TRT5", "06": "TRT6", "07": "TRT7", "08": "TRT8",
      "09": "TRT9", "10": "TRT10", "11": "TRT11", "12": "TRT12",
      "13": "TRT13", "14": "TRT14", "15": "TRT15", "16": "TRT16",
      "17": "TRT17", "18": "TRT18", "19": "TRT19", "20": "TRT20",
      "21": "TRT21", "22": "TRT22", "23": "TRT23", "24": "TRT24",
    };
    return trtMap[tribunal] || "TRT4";
  }
  if (justice === "6") return "TSE";
  return "TRF4_JFRS";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { html, tenant_id } = await req.json();

    if (!html || typeof html !== "string" || html.length < 50) {
      return new Response(
        JSON.stringify({ success: false, error: "HTML inválido ou muito curto" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: tenant } = await supabase.from("tenants").select("id").eq("id", tenant_id).single();
    if (!tenant) {
      return new Response(
        JSON.stringify({ success: false, error: "Escritório não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsed = parseSearchResults(html);
    console.log(`[mass-import] Parsed ${parsed.length} processes. Samples:`,
      JSON.stringify(parsed.slice(0, 5).map(p => ({
        num: p.process_number,
        author: p.author,
        defendant: p.defendant,
      }))));

    if (parsed.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Nenhum número de processo encontrado na página." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let casesCreated = 0;
    let casesSkipped = 0;
    const importedProcesses: string[] = [];

    for (const proc of parsed) {
      const digits = proc.process_number.replace(/\D/g, "");

      const { data: existing } = await supabase
        .from("cases")
        .select("id")
        .eq("tenant_id", tenant_id)
        .or(`process_number.eq.${proc.process_number},process_number.eq.${digits}`)
        .limit(1)
        .maybeSingle();

      if (existing) {
        casesSkipped++;
        continue;
      }

      const source = inferSource(proc.process_number);

      // Store as "Autor | Réu" clean format
      const parts: string[] = [];
      if (proc.author) parts.push(proc.author);
      if (proc.defendant) parts.push(proc.defendant);
      const partiesSummary = parts.length > 0 ? parts.join(" | ") : null;

      const { error: caseErr } = await supabase.from("cases").insert({
        tenant_id,
        process_number: proc.process_number,
        source,
        subject: proc.subject,
        simple_status: "Importado",
        automation_enabled: true,
        case_summary: partiesSummary,
      });

      if (caseErr) {
        console.error(`[mass-import] Error creating case ${proc.process_number}:`, caseErr.message);
        continue;
      }

      casesCreated++;
      importedProcesses.push(proc.process_number);
    }

    console.log(`[mass-import] Done: ${casesCreated} created, ${casesSkipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        total_found: parsed.length,
        cases_created: casesCreated,
        cases_skipped: casesSkipped,
        imported_processes: importedProcesses.slice(0, 20),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[mass-import] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
