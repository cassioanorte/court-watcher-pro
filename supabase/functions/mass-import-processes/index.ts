import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ParsedProcess {
  process_number: string;
  parties: string[];
  subject: string | null;
  status: string | null;
}

/** Legal/procedural terms that should NEVER be treated as party names */
const LEGAL_TERMS = new Set([
  "direito civil", "direito penal", "direito administrativo", "direito do consumidor",
  "direito previdenciário", "direito tributário", "direito ambiental", "direito do trabalho",
  "direito processual civil", "direito processual penal", "direito constitucional",
  "direito empresarial", "direito de família", "direito internacional",
  "movimento", "movimentação", "movimentos", "susp", "suspenso", "suspensa",
  "ao tj", "ao trf", "ao trt", "ao tst", "ao stj", "ao stf",
  "procedimento comum cível", "procedimento comum", "procedimento do juizado especial cível",
  "procedimento do juizado especial", "procedimento sumário", "procedimento ordinário",
  "cumprimento de sentença", "execução de título extrajudicial", "execução fiscal",
  "mandado de segurança", "habeas corpus", "habeas data",
  "embargos", "embargos de declaração", "embargos de terceiro", "embargos à execução",
  "incidente de desconsideração de personalidade jurídica",
  "liquidação por arbitramento", "liquidação por artigos",
  "usucapião", "inventário", "arrolamento", "divórcio", "interdição",
  "ação civil pública", "ação popular", "ação rescisória",
  "recurso inominado", "apelação", "agravo de instrumento", "agravo interno",
  "tutela de urgência", "tutela provisória", "tutela antecipada",
  "juntada", "petição", "despacho", "sentença", "decisão", "acórdão",
  "distribuição", "conclusão", "intimação", "citação", "notificação",
  "outras matérias de direito público", "matérias de direito público",
  "direito civil movimento", "direito do consumidor movimento",
  "direito previdenciário movimento", "direito administrativo e outras matérias",
  "direito administrativo e outras matérias de direito público",
  "direito civil susp", "direito do consumidor susp",
  "olada juntada", "em recuperacao judicial", "recuperação judicial",
  "ras matérias de direito público",
]);

function isLegalTerm(name: string): boolean {
  const lower = name.toLowerCase().trim();
  if (LEGAL_TERMS.has(lower)) return true;
  // Check if it starts with any legal term
  for (const term of LEGAL_TERMS) {
    if (lower.startsWith(term) && lower.length < term.length + 15) return true;
    if (lower === term) return true;
  }
  // Additional patterns that indicate non-names
  if (/^direito\b/i.test(lower)) return true;
  if (/^procedimento\b/i.test(lower)) return true;
  if (/^cumprimento\b/i.test(lower)) return true;
  if (/^execução\b/i.test(lower)) return true;
  if (/^incidente\b/i.test(lower)) return true;
  if (/^liquidação\b/i.test(lower)) return true;
  if (/^recurso\b/i.test(lower)) return true;
  if (/^tutela\b/i.test(lower)) return true;
  if (/^mandado\b/i.test(lower)) return true;
  if (/^embargos\b/i.test(lower)) return true;
  if (/^ação\b/i.test(lower)) return true;
  if (/^agravo\b/i.test(lower)) return true;
  if (/^apelação\b/i.test(lower)) return true;
  if (/\bmovimento\b/i.test(lower)) return true;
  if (/\bsusp$/i.test(lower)) return true;
  if (/\bjuntada\b/i.test(lower)) return true;
  if (/\bsentença\b/i.test(lower)) return true;
  if (/^ao\s+t[jrf]/i.test(lower)) return true;
  if (/^matérias?\b/i.test(lower)) return true;
  if (/^outras\b/i.test(lower)) return true;
  return false;
}

function cleanName(name: string): string {
  let n = name.replace(/\s+/g, " ").trim();
  n = n.replace(/^[,;:\-–—.]+|[,;:\-–—.]+$/g, "").trim();
  if (n.length < 4 || n.length > 200) return "";
  if (/^\d{7}/.test(n) || /^\d{2}\/\d{2}\/\d{4}/.test(n)) return "";
  if (isLegalTerm(n)) return "";
  // Must contain at least one letter
  if (!/[a-zA-ZÀ-ú]/.test(n)) return "";
  // Must have at least 2 words for a person name
  const words = n.split(/\s+/).filter(w => w.length > 1);
  if (words.length < 2) return "";
  return n;
}

/**
 * Extract party names from the text context around a process number.
 * Returns array of clean party names (people/companies only).
 */
function extractParties(context: string): string[] {
  const parties: string[] = [];
  const seen = new Set<string>();

  const addParty = (name: string) => {
    const cleaned = cleanName(name);
    if (cleaned && !seen.has(cleaned.toLowerCase())) {
      seen.add(cleaned.toLowerCase());
      parties.push(cleaned);
    }
  };

  // Pattern 1: Labeled parties — most reliable
  const labeledPatterns = [
    /(?:Autor|Autora|Requerente|Exequente|Reclamante|Impetrante|Apelante|Agravante|Embargante|Recorrente)\s*:\s*([^\n|<]{3,100})/gi,
    /(?:Réu|Ré|Requerido|Requerida|Executado|Executada|Reclamado|Reclamada|Impetrado|Impetrada|Apelado|Apelada|Agravado|Agravada|Embargado|Embargada|Recorrido|Recorrida)\s*:\s*([^\n|<]{3,100})/gi,
  ];
  for (const pattern of labeledPatterns) {
    let m;
    while ((m = pattern.exec(context)) !== null) {
      const names = m[1].split(/\s*,\s*|\s+e\s+/);
      for (const name of names) addParty(name);
    }
  }

  // Pattern 2: "NOME1 x NOME2" — but only if both sides look like real names
  const vsMatch = context.match(/([A-ZÀ-Ú][A-ZÀ-Ú\s.]+?)\s+(?:x|X|vs\.?)\s+([A-ZÀ-Ú][A-ZÀ-Ú\s.]+?)(?:\s*[-–—\n|]|$)/);
  if (vsMatch) {
    addParty(vsMatch[1]);
    addParty(vsMatch[2]);
  }

  return parties;
}

function parseSearchResults(html: string): ParsedProcess[] {
  const processes: ParsedProcess[] = [];
  const seen = new Set<string>();

  const cnjPattern = /(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/g;
  let match;

  while ((match = cnjPattern.exec(html)) !== null) {
    const num = match[1];
    if (seen.has(num)) continue;
    seen.add(num);

    const startIdx = Math.max(0, match.index - 500);
    const endIdx = Math.min(html.length, match.index + 1000);
    const htmlContext = html.substring(startIdx, endIdx);
    const textContext = htmlContext
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#\d+;/g, " ")
      .replace(/\s+/g, " ");

    const parties = extractParties(textContext);

    let subject: string | null = null;
    const subjectMatch = textContext.match(
      /(?:Classe|Assunto|Ação|Competência)\s*:\s*([^,\n|]{3,200})/i
    );
    if (subjectMatch) subject = subjectMatch[1].trim().substring(0, 200);

    let status: string | null = null;
    const statusMatch = textContext.match(
      /(?:Situação|Status)\s*:\s*([^,\n|]{3,100})/i
    );
    if (statusMatch) status = statusMatch[1].trim();

    processes.push({ process_number: num, parties, subject, status });
  }

  // Also try pure 20-digit numbers
  const digitPattern = /(?<!\d)(\d{20})(?!\d)/g;
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
  while ((match = digitPattern.exec(text)) !== null) {
    const d = match[1];
    const formatted = `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16, 20)}`;
    if (!seen.has(formatted)) {
      seen.add(formatted);
      processes.push({ process_number: formatted, parties: [], subject: null, status: null });
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
    console.log(`[mass-import] Parsed ${parsed.length} processes. Sample parties:`,
      JSON.stringify(parsed.slice(0, 3).map(p => ({ num: p.process_number, parties: p.parties }))));

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

      // Store clean parties in case_summary as "Parte1 | Parte2"
      const partiesSummary = proc.parties.length > 0
        ? proc.parties.join(" | ")
        : null;

      const { error: caseErr } = await supabase.from("cases").insert({
        tenant_id,
        process_number: proc.process_number,
        source,
        subject: proc.subject,
        simple_status: proc.status || "Importado",
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
