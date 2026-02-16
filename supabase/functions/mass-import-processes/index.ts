import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface StructuredProcess {
  process_number: string;
  author: string | null;
  defendant: string | null;
  classe: string | null;
  subject: string | null;
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

    const body = await req.json();
    const { tenant_id } = body;
    const processes: StructuredProcess[] = body.processes || [];

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (processes.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Nenhum processo recebido" }),
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

    console.log(`[mass-import] Received ${processes.length} structured processes. Samples:`,
      JSON.stringify(processes.slice(0, 3)));

    let casesCreated = 0;
    let casesSkipped = 0;

    for (const proc of processes) {
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

      // Build case_summary as "Autor | Réu"
      const parts: string[] = [];
      if (proc.author) parts.push(proc.author);
      if (proc.defendant) parts.push(proc.defendant);
      const caseSummary = parts.length > 0 ? parts.join(" | ") : null;

      // Build subject: prefer assunto, fallback to classe
      const subject = proc.subject || proc.classe || null;

      const { error: caseErr } = await supabase.from("cases").insert({
        tenant_id,
        process_number: proc.process_number,
        source,
        subject,
        simple_status: "Importado",
        automation_enabled: true,
        case_summary: caseSummary,
      });

      if (caseErr) {
        console.error(`[mass-import] Error creating case ${proc.process_number}:`, caseErr.message);
        continue;
      }

      casesCreated++;
    }

    console.log(`[mass-import] Done: ${casesCreated} created, ${casesSkipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        total_found: processes.length,
        cases_created: casesCreated,
        cases_skipped: casesSkipped,
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
