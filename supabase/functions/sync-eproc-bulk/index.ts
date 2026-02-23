import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ProcessData {
  process_number: string;
  parties: string | null;
  subject: string | null;
  movements: { title: string; date: string; details: string | null }[];
  documents?: { process_number: string; document_name: string; document_url: string }[];
}

function classifyDocType(name: string): string {
  const n = name.toLowerCase();
  if (/rpv|requisição de pequeno valor/.test(n)) return "rpv";
  if (/precatório|precatorio/.test(n)) return "precatorio";
  if (/alvará|alvara/.test(n)) return "alvara";
  if (/sentença|sentenca/.test(n)) return "sentenca";
  if (/acórdão|acordao/.test(n)) return "acordao";
  if (/despacho/.test(n)) return "despacho";
  if (/petição|peticao/.test(n)) return "peticao";
  if (/contestação|contestacao/.test(n)) return "contestacao";
  if (/recurso|apelação|apelacao|agravo/.test(n)) return "recurso";
  return "outro";
}

function inferSource(processNumber: string, eprocHost: string): string {
  const hostLower = eprocHost.toLowerCase();
  if (hostLower.includes("tjrs")) return "TJRS_1G";
  if (hostLower.includes("jfrs")) return "TRF4_JFRS";
  if (hostLower.includes("jfsc")) return "TRF4_JFSC";
  if (hostLower.includes("jfpr")) return "TRF4_JFPR";
  if (hostLower.includes("trf4")) return "TRF4";

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
  return "TRF4_JFRS";
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

function generateDocHash(tenantId: string, procNum: string, docName: string, docUrl: string): string {
  const raw = `${tenantId}:${procNum}:${docName}:${docUrl}`;
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

    const body = await req.json();
    const { tenant_id, user_id, eproc_host, processes, documents: allDocuments, sync_log_id } = body as {
      tenant_id: string;
      user_id: string;
      eproc_host: string;
      processes: ProcessData[];
      documents?: { process_number: string; document_name: string; document_url: string }[];
      sync_log_id?: string;
    };

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!processes || processes.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Nenhum processo recebido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[sync-eproc-bulk] Received ${processes.length} processes from ${eproc_host} for tenant ${tenant_id}`);

    let processesSynced = 0;
    let movementsSynced = 0;
    let casesCreated = 0;
    let documentsSaved = 0;

    // Map to store process_number -> case_id for document linking
    const caseMap = new Map<string, string>();

    for (const proc of processes) {
      const digits = proc.process_number.replace(/\D/g, "");

      let { data: existingCase } = await supabase
        .from("cases")
        .select("id")
        .eq("tenant_id", tenant_id)
        .or(`process_number.eq.${proc.process_number},process_number.eq.${digits}`)
        .limit(1)
        .maybeSingle();

      let caseId: string;

      if (existingCase) {
        caseId = existingCase.id;
        const updates: Record<string, unknown> = { last_checked_at: new Date().toISOString() };
        if (proc.parties) updates.parties = proc.parties;
        if (proc.subject) updates.subject = proc.subject;
        await supabase.from("cases").update(updates).eq("id", caseId);
      } else {
        const source = inferSource(proc.process_number, eproc_host);
        const { data: newCase, error: caseErr } = await supabase.from("cases").insert({
          tenant_id,
          process_number: proc.process_number,
          source,
          subject: proc.subject,
          parties: proc.parties,
          simple_status: "Importado",
          automation_enabled: true,
          last_checked_at: new Date().toISOString(),
        }).select("id").single();

        if (caseErr) {
          console.error(`[sync-eproc-bulk] Error creating case ${proc.process_number}:`, caseErr.message);
          continue;
        }
        caseId = newCase.id;
        casesCreated++;
      }

      caseMap.set(proc.process_number, caseId);

      // Insert movements
      if (proc.movements && proc.movements.length > 0) {
        for (const mov of proc.movements) {
          const uniqueHash = generateHash(caseId, mov.title, mov.date);
          const { error } = await supabase.from("movements").upsert(
            {
              case_id: caseId,
              title: mov.title.substring(0, 500),
              details: mov.details,
              occurred_at: mov.date,
              source_label: eproc_host || "eproc-sync",
              source_raw: null,
              unique_hash: uniqueHash,
              is_manual: false,
            },
            { onConflict: "unique_hash", ignoreDuplicates: true }
          );
          if (!error) movementsSynced++;
        }
      }

      processesSynced++;
    }

    // Save discovered documents
    const docsToSave = allDocuments || [];
    // Also collect docs from within processes
    for (const proc of processes) {
      if (proc.documents) {
        for (const doc of proc.documents) {
          const alreadyInAll = docsToSave.some(d => d.document_url === doc.document_url);
          if (!alreadyInAll) docsToSave.push(doc);
        }
      }
    }

    if (docsToSave.length > 0) {
      for (const doc of docsToSave) {
        const uniqueHash = generateDocHash(tenant_id, doc.process_number, doc.document_name, doc.document_url);
        const caseId = caseMap.get(doc.process_number) || null;
        const docType = classifyDocType(doc.document_name);

        const { error } = await supabase.from("eproc_documents").upsert(
          {
            tenant_id,
            case_id: caseId,
            process_number: doc.process_number,
            document_name: doc.document_name,
            document_url: doc.document_url,
            document_type: docType,
            status: "discovered",
            unique_hash: uniqueHash,
          },
          { onConflict: "unique_hash", ignoreDuplicates: true }
        );
        if (!error) documentsSaved++;
      }
      console.log(`[sync-eproc-bulk] Saved ${documentsSaved} documents`);
    }

    // Create/update sync log
    const source = inferSource(processes[0]?.process_number || "", eproc_host);
    if (sync_log_id) {
      await supabase.from("eproc_sync_logs").update({
        processes_synced: processesSynced,
        movements_synced: movementsSynced,
        status: "completed",
        completed_at: new Date().toISOString(),
      }).eq("id", sync_log_id);
    } else {
      await supabase.from("eproc_sync_logs").insert({
        tenant_id,
        user_id,
        source,
        processes_found: processes.length,
        processes_synced: processesSynced,
        movements_synced: movementsSynced,
        status: "completed",
        completed_at: new Date().toISOString(),
      });
    }

    console.log(`[sync-eproc-bulk] Done: ${processesSynced} processes, ${casesCreated} new, ${movementsSynced} movements, ${documentsSaved} docs`);

    return new Response(
      JSON.stringify({
        success: true,
        processes_synced: processesSynced,
        cases_created: casesCreated,
        movements_synced: movementsSynced,
        documents_saved: documentsSaved,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[sync-eproc-bulk] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
