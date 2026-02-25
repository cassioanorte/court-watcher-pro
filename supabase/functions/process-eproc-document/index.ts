import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// RPV/Precatório parser (server-side version of rpvParser.ts)
function parseMoney(str: string): number {
  const clean = str.replace(/R\$\s*/gi, "").trim();
  if (clean.includes(",")) {
    return parseFloat(clean.replace(/\./g, "").replace(",", ".")) || 0;
  }
  return parseFloat(clean) || 0;
}

function parseDate(dateStr: string): string | null {
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function extractMoneyValue(text: string, ...patterns: RegExp[]): number | null {
  for (const pat of patterns) {
    const match = text.match(pat);
    if (match) {
      const val = parseMoney(match[1]);
      if (val > 0) return val;
    }
  }
  return null;
}

function parseRpvFromText(text: string) {
  const t = text.replace(/\s+/g, " ");

  let type: "rpv" | "precatorio" | null = null;
  if (/precatório|precatorio|PRECATÓRIO/i.test(text)) type = "precatorio";
  if (/RPV|requisição de pequeno valor|requisicao de pequeno valor/i.test(text)) type = "rpv";

  // Beneficiary
  let beneficiary_name: string | null = null;
  const benefPatterns = [
    /(?:benefici[aá]rio|autor|requerente|credor|exequente|interessado)[:\s]+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇa-záéíóúâêîôûãõç\s]+?)(?:\s*[-–]\s*\d{3}[\.\d]*|\s*CPF|\s*[,;]|\s*\d{3}\.\d{3}|$)/i,
    /([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇa-záéíóúâêîôûãõç\s]{3,50}?)\s*[-–]\s*\d{3}\.\d{3}\.\d{3}-\d{2}/i,
  ];
  for (const pat of benefPatterns) {
    const m = t.match(pat);
    if (m) { beneficiary_name = m[1].trim(); break; }
  }

  const cpfMatch = t.match(/CPF[:\s]*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i) ||
    t.match(/[-–]\s*(\d{3}\.\d{3}\.\d{3}-\d{2})/) ||
    t.match(/(\d{3}\.\d{3}\.\d{3}-\d{2})/);
  const beneficiary_cpf = cpfMatch ? cpfMatch[1] : null;

  const cnjMatch = t.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
  const process_number = cnjMatch ? cnjMatch[1] : null;

  let court: string | null = null;
  const courtM = t.match(/(?:vara|juízo|tribunal)[:\s]+([^\n,;]{5,60})/i);
  if (courtM) court = courtM[1].trim();

  let entity: string | null = null;
  const entityM = t.match(/(?:entidade devedora|devedor|réu|executado)[:\s]+([^\n,;]{3,60})/i);
  if (entityM) entity = entityM[1].trim();
  if (!entity && /INSS/i.test(t)) entity = "INSS";
  if (!entity && /União Federal/i.test(t)) entity = "União Federal";

  const gross_amount = extractMoneyValue(t,
    /(?:valor\s+total\s+devido)[^)]*\)\s*([\d.,]+)/i,
    /(?:valor\s+total\s+devido)[^\d]*([\d.,]+)/i,
    /(?:valor\s+(?:bruto|total|principal|líquido da requisição|requisitado))[:\s]*R?\$?\s*([\d.,]+)/i,
  );

  const court_costs = extractMoneyValue(t, /(?:custas?\s+(?:judiciais?|processuais?))[:\s]*R?\$?\s*([\d.,]+)/i);
  const social_security = extractMoneyValue(t, /(?:contribui[çc][ãa]o\s+previdenci[áa]ria|INSS\s+retido)[:\s]*R?\$?\s*([\d.,]+)/i);
  const income_tax = extractMoneyValue(t, /(?:imposto\s+de\s+renda|IR(?:RF)?|IRPF)[:\s]*R?\$?\s*([\d.,]+)/i);

  let office_fees_percent: number | null = null;
  const feeMatch = t.match(/(?:honor[áa]rios?)[:\s]*(\d+(?:[.,]\d+)?)\s*%/i);
  if (feeMatch) office_fees_percent = parseFloat(feeMatch[1].replace(",", "."));

  let office_amount = extractMoneyValue(t, /(?:honor[áa]rios?\s+(?:advocat[íi]cios?|contratuais?|sucumbenciais?))[:\s]*R?\$?\s*([\d.,]+)/i);
  let client_amount = extractMoneyValue(t, /(?:valor\s+(?:líquido|l[ií]quido)\s+(?:do\s+)?(?:cliente|autor))[:\s]*R?\$?\s*([\d.,]+)/i);

  if (gross_amount && office_fees_percent && !office_amount) {
    office_amount = Math.round(gross_amount * office_fees_percent / 100 * 100) / 100;
  }
  if (gross_amount && office_amount && !client_amount) {
    const deductions = (court_costs || 0) + (social_security || 0) + (income_tax || 0);
    client_amount = Math.round((gross_amount - office_amount - deductions) * 100) / 100;
  }

  let reference_date: string | null = null;
  const refDateMatch = t.match(/(?:data\s+(?:base|do\s+cálculo|de\s+refer[êe]ncia))[:\s]*(\d{2}\/\d{2}\/\d{4})/i);
  if (refDateMatch) reference_date = parseDate(refDateMatch[1]);

  let expected_payment_date: string | null = null;
  const expDateMatch = t.match(/(?:previs[ãa]o\s+(?:de\s+)?pagamento|data\s+(?:de\s+)?pagamento)[:\s]*(\d{2}\/\d{2}\/\d{4})/i);
  if (expDateMatch) expected_payment_date = parseDate(expDateMatch[1]);

  return {
    type, gross_amount, office_fees_percent, office_amount, client_amount,
    court_costs, social_security, income_tax, beneficiary_name, beneficiary_cpf,
    process_number, court, entity, reference_date, expected_payment_date,
  };
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
    const { tenant_id, user_id, document_id, pdf_text, process_number } = body as {
      tenant_id: string;
      user_id: string;
      document_id: string;
      pdf_text: string;
      process_number?: string;
    };

    if (!tenant_id || !document_id || !pdf_text) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[process-eproc-document] Processing document ${document_id} for tenant ${tenant_id}`);

    const parsed = parseRpvFromText(pdf_text);
    const isPaymentDoc = parsed.type === "rpv" || parsed.type === "precatorio";

    let paymentOrderId: string | null = null;

    if (isPaymentDoc && parsed.gross_amount) {
      // Find the case by process number
      const procNum = parsed.process_number || process_number;
      let caseId: string | null = null;

      if (procNum) {
        const { data: caseData } = await supabase
          .from("cases")
          .select("id")
          .eq("tenant_id", tenant_id)
          .or(`process_number.eq.${procNum},process_number.eq.${procNum.replace(/\D/g, "")}`)
          .limit(1)
          .maybeSingle();
        if (caseData) caseId = caseData.id;
      }

      // Create payment order
      const { data: po, error: poErr } = await supabase.from("payment_orders").insert({
        tenant_id,
        created_by: user_id,
        type: parsed.type,
        process_number: procNum,
        case_id: caseId,
        gross_amount: parsed.gross_amount,
        office_fees_percent: parsed.office_fees_percent,
        office_amount: parsed.office_amount,
        client_amount: parsed.client_amount,
        court_costs: parsed.court_costs,
        social_security: parsed.social_security,
        income_tax: parsed.income_tax,
        beneficiary_name: parsed.beneficiary_name,
        beneficiary_cpf: parsed.beneficiary_cpf,
        court: parsed.court,
        entity: parsed.entity,
        reference_date: parsed.reference_date,
        expected_payment_date: parsed.expected_payment_date,
        status: "rascunho",
        ownership_type: "cliente",
        fee_type: "contratuais",
        ai_extracted: false,
      }).select("id").single();

      if (poErr) {
        console.error("[process-eproc-document] Error creating payment order:", poErr.message);
      } else {
        paymentOrderId = po.id;
        console.log(`[process-eproc-document] Created payment order ${po.id}`);
      }
    }

    // Update the document record
    await supabase.from("eproc_documents").update({
      status: "processed",
      processed_at: new Date().toISOString(),
      processing_result: {
        is_payment_doc: isPaymentDoc,
        parsed_type: parsed.type,
        payment_order_id: paymentOrderId,
        extracted_data: parsed,
      },
    }).eq("id", document_id);

    return new Response(
      JSON.stringify({
        success: true,
        is_payment_doc: isPaymentDoc,
        payment_order_id: paymentOrderId,
        parsed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[process-eproc-document] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
