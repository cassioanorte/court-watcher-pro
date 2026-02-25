import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ParsedPaymentData {
  type?: "rpv" | "precatorio" | "alvara" | null;
  gross_amount?: number | string | null;
  office_fees_percent?: number | string | null;
  office_amount?: number | string | null;
  client_amount?: number | string | null;
  court_costs?: number | string | null;
  social_security?: number | string | null;
  income_tax?: number | string | null;
  beneficiary_name?: string | null;
  beneficiary_cpf?: string | null;
  process_number?: string | null;
  court?: string | null;
  entity?: string | null;
  reference_date?: string | null;
  expected_payment_date?: string | null;
  ownership_type?: string;
  fee_type?: string;
}

interface DocumentInput {
  name: string;
  url: string;
  event_number: string;
  doc_type: "rpv" | "precatorio" | "alvara" | "outro";
  fee_type?: "contratuais" | "sucumbencia";
  parsed_single?: ParsedPaymentData;
  parsed_entries?: ParsedPaymentData[];
  pdf_read_error?: string;
}

interface PaymentCandidate {
  feeType: "contratuais" | "sucumbencia";
  ownershipType: string;
  parsed?: ParsedPaymentData;
}

function generateHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

const normalizeFeeType = (value?: string | null): "contratuais" | "sucumbencia" | null => {
  if (value === "contratuais" || value === "sucumbencia") return value;
  return null;
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const normalized = value.replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const asText = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const hasMeaningfulParsedData = (parsed?: ParsedPaymentData): boolean => {
  if (!parsed) return false;
  return (
    (asNumber(parsed.gross_amount) ?? 0) > 0 ||
    !!asText(parsed.beneficiary_name) ||
    !!asText(parsed.reference_date) ||
    !!asText(parsed.entity)
  );
};

const dedupeParsedEntries = (entries: ParsedPaymentData[]) => {
  const unique = new Map<string, ParsedPaymentData>();
  for (const entry of entries) {
    const fee = normalizeFeeType(entry.fee_type) || "contratuais";
    const gross = asNumber(entry.gross_amount) ?? 0;
    const date = asText(entry.reference_date) || "";
    const name = asText(entry.beneficiary_name) || "";
    const key = `${fee}:${gross}:${date}:${name}`;
    if (!unique.has(key)) unique.set(key, entry);
  }
  return [...unique.values()];
};

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
    let paymentOrdersSkipped = 0;

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
          processing_result: {
            source_url: source_url || null,
            has_parsed_single: !!doc.parsed_single,
            parsed_entries_count: Array.isArray(doc.parsed_entries) ? doc.parsed_entries.length : 0,
            pdf_read_error: doc.pdf_read_error || null,
          },
        }, { onConflict: "unique_hash", ignoreDuplicates: true })
        .select("id")
        .maybeSingle();

      if (insertErr) {
        console.error(`[capture-documents] Error saving doc: ${insertErr.message}`);
        continue;
      }

      if (!inserted) {
        documentsSkipped++;
      } else {
        documentsSaved++;
      }

      // For financial documents, create payment orders with proper fee_type
      if ((doc.doc_type === "rpv" || doc.doc_type === "precatorio" || doc.doc_type === "alvara") && userId) {
        const docFeeType = doc.fee_type || "contratuais";
        const paymentCandidates: PaymentCandidate[] = [];

        const parsedEntries = Array.isArray(doc.parsed_entries)
          ? dedupeParsedEntries(doc.parsed_entries.filter((entry) => hasMeaningfulParsedData(entry)))
          : [];

        if (parsedEntries.length > 0) {
          for (const parsed of parsedEntries) {
            const feeType = normalizeFeeType(parsed.fee_type) || normalizeFeeType(doc.fee_type) || "contratuais";
            paymentCandidates.push({
              feeType,
              parsed,
              ownershipType: asText(parsed.ownership_type) || "escritorio",
            });
          }
        } else if (hasMeaningfulParsedData(doc.parsed_single)) {
          const parsed = doc.parsed_single!;
          const feeType = normalizeFeeType(parsed.fee_type) || normalizeFeeType(doc.fee_type) || "contratuais";
          paymentCandidates.push({
            feeType,
            parsed,
            ownershipType: asText(parsed.ownership_type) || (feeType === "sucumbencia" ? "escritorio" : "cliente"),
          });
        } else {
          // Fallback heuristics based on document title
          const normalizedName = doc.name
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase()
            .trim();

          const hasContratuais = normalizedName.includes("CONTRATUA");
          const hasSucumbencia = normalizedName.includes("SUCUMB");

          let feeTypes: ("contratuais" | "sucumbencia")[];

          if (hasContratuais && hasSucumbencia) {
            feeTypes = ["contratuais", "sucumbencia"];
          } else if (hasSucumbencia) {
            feeTypes = ["sucumbencia"];
          } else if (hasContratuais) {
            feeTypes = ["contratuais"];
          } else {
            feeTypes = [docFeeType];
          }

          for (const feeType of feeTypes) {
            paymentCandidates.push({
              feeType,
              ownershipType: feeType === "sucumbencia" ? "escritorio" : "cliente",
            });
          }
        }

        for (const candidate of paymentCandidates) {
          const parsed = candidate.parsed;

          const parsedProcessNumber = asText(parsed?.process_number);
          const resolvedProcessNumber = parsedProcessNumber || process_number;

          // Check if payment order already exists for this doc + fee_type combo
          const { data: existingPO } = await supabase
            .from("payment_orders")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("process_number", resolvedProcessNumber)
            .eq("document_name", doc.name)
            .eq("fee_type", candidate.feeType)
            .limit(1)
            .maybeSingle();

          if (existingPO) {
            paymentOrdersSkipped++;
            continue;
          }

          const parsedType = parsed?.type;
          const poType =
            doc.doc_type === "alvara"
              ? "alvara"
              : parsedType === "rpv" || parsedType === "precatorio"
                ? parsedType
                : doc.doc_type;

          const grossAmount = asNumber(parsed?.gross_amount) ?? 0;
          const officeAmount =
            asNumber(parsed?.office_amount) ??
            (candidate.ownershipType === "escritorio" ? grossAmount : 0);
          const clientAmount =
            asNumber(parsed?.client_amount) ??
            (candidate.ownershipType === "cliente" ? grossAmount : 0);

          const feeLabel = candidate.feeType === "sucumbencia" ? "Sucumbência" : "Contratuais";
          const enrichedNote = parsed
            ? " Valores extraídos automaticamente do PDF."
            : " Pendente de conferência.";

          const { error: poErr } = await supabase.from("payment_orders").insert({
            tenant_id,
            created_by: userId,
            type: poType,
            process_number: resolvedProcessNumber,
            case_id: caseId,
            status: "rascunho",
            ownership_type: candidate.ownershipType,
            fee_type: candidate.feeType,
            ai_extracted: false,
            document_name: doc.name,
            document_url: doc.url,
            gross_amount: grossAmount,
            office_fees_percent: asNumber(parsed?.office_fees_percent) ?? 0,
            office_amount: officeAmount,
            client_amount: clientAmount,
            court_costs: asNumber(parsed?.court_costs) ?? 0,
            social_security: asNumber(parsed?.social_security) ?? 0,
            income_tax: asNumber(parsed?.income_tax) ?? 0,
            beneficiary_name: asText(parsed?.beneficiary_name),
            beneficiary_cpf: asText(parsed?.beneficiary_cpf),
            court: asText(parsed?.court),
            entity: asText(parsed?.entity),
            reference_date: asText(parsed?.reference_date),
            expected_payment_date: asText(parsed?.expected_payment_date),
            notes: `Capturado via bookmarklet — ${feeLabel}${doc.event_number ? ` — Evento ${doc.event_number}` : ""}.${enrichedNote}`,
          });

          if (poErr) {
            console.error(`[capture-documents] Error creating payment order (${candidate.feeType}): ${poErr.message}`);
          } else {
            paymentOrdersCreated++;
          }
        }
      }
    }

    console.log(`[capture-documents] Process ${process_number}: saved=${documentsSaved}, skipped=${documentsSkipped}, POs=${paymentOrdersCreated}, POsSkipped=${paymentOrdersSkipped}`);

    return new Response(
      JSON.stringify({
        success: true,
        documents_saved: documentsSaved,
        documents_skipped: documentsSkipped,
        payment_orders_created: paymentOrdersCreated,
        payment_orders_skipped: paymentOrdersSkipped,
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
