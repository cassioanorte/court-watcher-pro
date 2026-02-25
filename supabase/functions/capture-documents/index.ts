import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface DocumentInput {
  name: string;
  url: string;
  event_number: string;
  doc_type: "rpv" | "precatorio" | "alvara" | "outro";
}

function generateHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
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

    const { documents, process_number, tenant_id, source_url } = await req.json() as {
      documents: DocumentInput[];
      process_number: string;
      tenant_id: string;
      source_url?: string;
    };

    if (!documents?.length || !process_number || !tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Dados obrigatórios ausentes" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the case
    const digits = process_number.replace(/\D/g, "");
    const { data: caseData } = await supabase
      .from("cases")
      .select("id, process_number, client_user_id")
      .eq("tenant_id", tenant_id)
      .or(`process_number.eq.${process_number},process_number.eq.${digits}`)
      .limit(1)
      .maybeSingle();

    const caseId = caseData?.id || null;

    // Find a staff user for created_by (owner of tenant)
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("tenant_id", tenant_id)
      .limit(1)
      .maybeSingle();
    const userId = ownerProfile?.user_id || null;

    let documentsSaved = 0;
    let documentsSkipped = 0;
    let paymentOrdersCreated = 0;

    for (const doc of documents) {
      const uniqueHash = generateHash(`${tenant_id}:${process_number}:${doc.name}:${doc.event_number}`);

      // Save to eproc_documents
      const { data: inserted, error: insertErr } = await supabase
        .from("eproc_documents")
        .upsert({
          tenant_id,
          process_number,
          case_id: caseId,
          document_name: doc.name.substring(0, 500),
          document_url: doc.url,
          document_type: doc.doc_type,
          unique_hash: uniqueHash,
          status: doc.doc_type !== "outro" ? "pending_review" : "captured",
        }, { onConflict: "unique_hash", ignoreDuplicates: true })
        .select("id")
        .maybeSingle();

      if (insertErr) {
        console.error(`[capture-documents] Error saving doc: ${insertErr.message}`);
        continue;
      }

      if (!inserted) {
        documentsSkipped++;
        continue;
      }

      documentsSaved++;

      // For financial documents, create payment order
      if ((doc.doc_type === "rpv" || doc.doc_type === "precatorio" || doc.doc_type === "alvara") && userId) {
        const poType = doc.doc_type === "alvara" ? "alvara" : doc.doc_type;
        const { error: poErr } = await supabase.from("payment_orders").insert({
          tenant_id,
          created_by: userId,
          type: poType,
          process_number,
          case_id: caseId,
          status: "rascunho",
          ownership_type: "cliente",
          fee_type: "contratual",
          ai_extracted: false,
          document_name: doc.name,
          document_url: doc.url,
          notes: `Capturado via bookmarklet${doc.event_number ? ` — Evento ${doc.event_number}` : ""}. Pendente de conferência.`,
        });

        if (poErr) {
          console.error(`[capture-documents] Error creating payment order: ${poErr.message}`);
        } else {
          paymentOrdersCreated++;
        }
      }
    }

    console.log(`[capture-documents] Process ${process_number}: saved=${documentsSaved}, skipped=${documentsSkipped}, POs=${paymentOrdersCreated}`);

    return new Response(
      JSON.stringify({
        success: true,
        documents_saved: documentsSaved,
        documents_skipped: documentsSkipped,
        payment_orders_created: paymentOrdersCreated,
        case_id: caseId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[capture-documents] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
