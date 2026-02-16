const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// ── Regex extraction utilities ──

function extractWithRegex(text: string): Record<string, string> {
  const data: Record<string, string> = {};

  // CPF: 000.000.000-00
  const cpfMatch = text.match(/\b(\d{3}[.\s]?\d{3}[.\s]?\d{3}[-.\s]?\d{2})\b/);
  if (cpfMatch) {
    const raw = cpfMatch[1].replace(/\s/g, "").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(raw)) data.cpf = raw;
  }

  // RG: various patterns
  const rgMatch = text.match(/(?:RG|R\.G\.|Identidade|Carteira de Identidade)[:\s]*[nº°]*\s*([\d.\-\/]+)/i);
  if (rgMatch) data.rg = rgMatch[1].trim();

  // Address: common patterns in legal docs
  const addrPatterns = [
    /(?:residente|domiciliado|morador|endereço|reside)[a-z\s]*(?:na|em|à|no)\s+(.+?)(?:,\s*(?:CEP|nesta|portador|inscrit|brasileir|solteiro|casado|divorciado|viúv|natural|\d{5}-?\d{3}))/is,
    /(?:Rua|Avenida|Av\.|Travessa|Alameda|Rodovia|Estrada|Praça)\s+[^,]+,\s*(?:n[.ºo°]*\s*\d+[^,]*,\s*)?[^,]+(?:,\s*[^,]+)?(?:,\s*\w{2})?(?:\s*[-–]\s*CEP\s*\d{5}-?\d{3})?/i,
  ];
  for (const pattern of addrPatterns) {
    const m = text.match(pattern);
    if (m) {
      const addr = (m[1] || m[0]).replace(/\s+/g, " ").trim();
      if (addr.length > 10 && addr.length < 300) {
        data.address = addr;
        break;
      }
    }
  }

  // Phone: (XX) XXXXX-XXXX or (XX) XXXX-XXXX
  const phoneMatch = text.match(/\(?\d{2}\)?\s*9?\d{4}[-.\s]?\d{4}/);
  if (phoneMatch) data.phone = phoneMatch[0].trim();

  // Email
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) data.email = emailMatch[0].toLowerCase();

  // Civil status
  const civilMatch = text.match(/\b(solteiro|solteira|casado|casada|divorciado|divorciada|viúvo|viúva|separado|separada|união\s+estável)\b/i);
  if (civilMatch) {
    const raw = civilMatch[1].toLowerCase();
    if (raw.includes("solteir")) data.civil_status = "solteiro";
    else if (raw.includes("casad")) data.civil_status = "casado";
    else if (raw.includes("divorci")) data.civil_status = "divorciado";
    else if (raw.includes("viúv")) data.civil_status = "viúvo";
    else if (raw.includes("separad")) data.civil_status = "separado";
    else if (raw.includes("união")) data.civil_status = "união estável";
  }

  // Nationality
  const nacMatch = text.match(/\b(brasileir[oa]|estrangeir[oa]|portugues[a]?|italian[oa]|argentin[oa])\b/i);
  if (nacMatch) data.nacionalidade = nacMatch[1].charAt(0).toUpperCase() + nacMatch[1].slice(1).toLowerCase();

  // Birth place (naturalidade)
  const natMatch = text.match(/natural\s+d[eao]\s+([^,;.]+)/i);
  if (natMatch) data.naturalidade = natMatch[1].trim();

  // Mother's name
  const maeMatch = text.match(/(?:mãe|mae|filiação materna|genitora)[:\s]+([A-ZÀ-Ú][A-ZÀ-Ú\sa-zà-ú]+)/i);
  if (maeMatch) {
    const name = maeMatch[1].trim();
    if (name.split(/\s+/).length >= 2) data.nome_mae = name;
  }

  // Father's name
  const paiMatch = text.match(/(?:pai|filiação paterna|genitor)[:\s]+([A-ZÀ-Ú][A-ZÀ-Ú\sa-zà-ú]+)/i);
  if (paiMatch) {
    const name = paiMatch[1].trim();
    if (name.split(/\s+/).length >= 2) data.nome_pai = name;
  }

  // Birth date: DD/MM/YYYY
  const dateMatch = text.match(/(?:nascid[oa]?\s+em|data\s+de\s+nascimento|nascimento)[:\s]*(\d{2})[\/.-](\d{2})[\/.-](\d{4})/i);
  if (dateMatch) {
    const [, d, m, y] = dateMatch;
    const yr = parseInt(y);
    if (yr >= 1920 && yr <= 2010) data.birth_date = `${y}-${m}-${d}`;
  }

  // CNH
  const cnhMatch = text.match(/(?:CNH|Carteira\s+Nacional\s+de\s+Habilitação)[:\s]*[nº°]*\s*(\d[\d.\-\/]+\d)/i);
  if (cnhMatch) data.cnh = cnhMatch[1].trim();

  // CTPS
  const ctpsMatch = text.match(/(?:CTPS|Carteira\s+de\s+Trabalho)[:\s]*[nº°]*\s*(\d[\d.\-\/]+\d)/i);
  if (ctpsMatch) data.ctps = ctpsMatch[1].trim();

  // PIS/PASEP
  const pisMatch = text.match(/(?:PIS|PASEP|NIT)[:\s]*[nº°]*\s*(\d[\d.\-\/]+\d)/i);
  if (pisMatch) data.pis = pisMatch[1].trim();

  // Título de eleitor
  const tituloMatch = text.match(/(?:Título\s+de\s+Eleitor|Título\s+Eleitoral)[:\s]*[nº°]*\s*(\d[\d.\-\/\s]+\d)/i);
  if (tituloMatch) data.titulo_eleitor = tituloMatch[1].replace(/\s/g, "").trim();

  // Profession
  const profMatch = text.match(/(?:profissão|profissao|atividade\s+econômica|ocupação)[:\s]+([^,;.\n]+)/i);
  if (profMatch) {
    const prof = profMatch[1].trim();
    if (prof.length > 2 && prof.length < 80) data.atividade_economica = prof;
  }

  return data;
}

// Improved PDF text extraction - handles more PDF encodings
function extractTextFromPdfBytes(bytes: Uint8Array): string {
  const raw = new TextDecoder("latin1").decode(bytes);
  const textParts: string[] = [];
  
  // Method 1: Extract text between BT...ET blocks (PDF text objects)
  const btEtRegex = /BT\s([\s\S]*?)ET/g;
  let match;
  while ((match = btEtRegex.exec(raw)) !== null) {
    const block = match[1];
    // Tj operator
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tm;
    while ((tm = tjRegex.exec(block)) !== null) {
      textParts.push(tm[1]);
    }
    // TJ arrays
    const tjArrayRegex = /\[((?:\([^)]*\)|[^])*?)\]\s*TJ/g;
    while ((tm = tjArrayRegex.exec(block)) !== null) {
      const innerRegex = /\(([^)]*)\)/g;
      let inner;
      while ((inner = innerRegex.exec(tm[1])) !== null) {
        textParts.push(inner[1]);
      }
    }
    // ' and " operators (also set text)
    const quoteRegex = /\(([^)]*)\)\s*['"]/g;
    while ((tm = quoteRegex.exec(block)) !== null) {
      textParts.push(tm[1]);
    }
  }
  
  // Method 2: Try to decode PDF streams for text content
  const streamRegex = /stream\r?\n([\s\S]*?)endstream/g;
  while ((match = streamRegex.exec(raw)) !== null) {
    const streamContent = match[1];
    // Look for text in uncompressed streams
    const innerBtEt = /BT\s([\s\S]*?)ET/g;
    let sm;
    while ((sm = innerBtEt.exec(streamContent)) !== null) {
      const block = sm[1];
      const tjRegex2 = /\(([^)]*)\)\s*Tj/g;
      let tm2;
      while ((tm2 = tjRegex2.exec(block)) !== null) {
        textParts.push(tm2[1]);
      }
      const tjArrayRegex2 = /\[((?:\([^)]*\)|[^])*?)\]\s*TJ/g;
      while ((tm2 = tjArrayRegex2.exec(block)) !== null) {
        const innerRegex2 = /\(([^)]*)\)/g;
        let inner2;
        while ((inner2 = innerRegex2.exec(tm2[1])) !== null) {
          textParts.push(inner2[1]);
        }
      }
    }
  }
  
  // Unescape PDF string escapes
  let text = textParts
    .map(t => t
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\\\/g, "\\")
      .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    )
    .join(" ")
    .replace(/\s+/g, " ");

  // Method 3: If very little text found, try UTF-16 text extraction
  if (text.replace(/\s/g, "").length < 50) {
    // Try to find readable strings in the raw data
    const readableChunks: string[] = [];
    const readableRegex = /[A-ZÀ-Ÿa-zà-ÿ0-9.,;:!?@\-\/()]{5,}/g;
    let rm;
    while ((rm = readableRegex.exec(raw)) !== null) {
      readableChunks.push(rm[0]);
    }
    if (readableChunks.join(" ").length > text.length) {
      text = readableChunks.join(" ");
    }
  }

  return text;
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { document_id, case_id, process_number, file_base64, file_name, file_mime_type, auto_identify, use_ai } = await req.json();
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Auto-identify mode (AI only - needs to identify the person)
    if (auto_identify && file_base64) {
      return await handleAutoIdentify(admin, lovableKey, file_base64, file_mime_type || "application/pdf", file_name || "document.pdf", corsHeaders);
    }

    if (!case_id && !process_number) {
      return new Response(
        JSON.stringify({ error: "case_id or process_number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!document_id && !file_base64) {
      return new Response(
        JSON.stringify({ error: "document_id or file_base64 is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve case_id from process_number if needed
    let resolvedCaseId = case_id;
    if (!resolvedCaseId && process_number) {
      const cleanNumber = process_number.replace(/\D/g, "");
      const { data: cases } = await admin
        .from("cases")
        .select("id, client_user_id, process_number")
        .or(`process_number.eq.${process_number},process_number.eq.${cleanNumber}`);
      
      if (!cases || cases.length === 0) {
        const { data: partialCases } = await admin
          .from("cases")
          .select("id, client_user_id, process_number")
          .ilike("process_number", `%${cleanNumber}%`);
        
        if (!partialCases || partialCases.length === 0) {
          return new Response(
            JSON.stringify({ error: `Processo "${process_number}" não encontrado no sistema.` }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        resolvedCaseId = partialCases[0].id;
      } else {
        resolvedCaseId = cases[0].id;
      }
    }

    let docBase64: string;
    let docMimeType: string;
    let docName: string;

    if (file_base64) {
      docBase64 = file_base64;
      docMimeType = file_mime_type || "application/pdf";
      docName = file_name || "document.pdf";
    } else {
      const { data: doc, error: docError } = await admin
        .from("documents")
        .select("file_url, name")
        .eq("id", document_id)
        .single();
      if (docError || !doc) {
        return new Response(JSON.stringify({ error: "Document not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const docResponse = await fetch(doc.file_url);
      if (!docResponse.ok) {
        return new Response(
          JSON.stringify({ error: "Não foi possível baixar o documento." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const contentType = docResponse.headers.get("content-type") || "";
      const docBytes = new Uint8Array(await docResponse.arrayBuffer());
      let binary = "";
      for (let i = 0; i < docBytes.length; i += 8192) {
        const chunk = docBytes.subarray(i, Math.min(i + 8192, docBytes.length));
        for (let j = 0; j < chunk.length; j++) binary += String.fromCharCode(chunk[j]);
      }
      docBase64 = btoa(binary);
      docMimeType = contentType.includes("pdf") || doc.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : contentType.split(";")[0] || "image/jpeg";
      docName = doc.name;
    }

    // Default: try regex first, auto-fallback to AI if regex finds nothing useful
    if (use_ai) {
      return await extractAndUpdateProfileAI(admin, lovableKey, resolvedCaseId, docBase64, docMimeType, corsHeaders);
    } else {
      const regexResult = await extractAndUpdateProfileRegex(admin, resolvedCaseId, docBase64, docMimeType, corsHeaders, true);
      const regexBody = await regexResult.clone().json();
      // Auto-fallback to AI if regex found no data or PDF is image-based
      if (regexBody.auto_fallback_ai) {
        console.log("Regex found no useful data, auto-falling back to AI extraction");
        return await extractAndUpdateProfileAI(admin, lovableKey, resolvedCaseId, docBase64, docMimeType, corsHeaders);
      }
      return regexResult;
    }
  } catch (err) {
    console.error("Extract error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Regex-based extraction (no AI, no cost) ──

async function extractAndUpdateProfileRegex(
  admin: any, caseId: string, docBase64: string, docMimeType: string, corsHeaders: Record<string, string>, allowFallback = false
) {
  // Only works with PDFs (text-based)
  if (!docMimeType.includes("pdf")) {
    if (allowFallback) {
      return new Response(
        JSON.stringify({ auto_fallback_ai: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ error: "Extração por regex só funciona com PDFs de texto. Use a opção com IA para imagens.", method: "regex" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: caseData } = await admin
    .from("cases")
    .select("client_user_id")
    .eq("id", caseId)
    .single();
  if (!caseData?.client_user_id) {
    return new Response(
      JSON.stringify({ error: "Este processo não possui um cliente vinculado." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("cpf, rg, address, phone, email, civil_status, nacionalidade, naturalidade, nome_mae, nome_pai, birth_date, cnh, ctps, pis, titulo_eleitor, atividade_economica")
    .eq("user_id", caseData.client_user_id)
    .single();

  if (!profile) {
    return new Response(
      JSON.stringify({ error: "Perfil do cliente não encontrado." }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Decode base64 to bytes and extract text
  const binaryStr = atob(docBase64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  
  const pdfText = extractTextFromPdfBytes(bytes);
  console.log("Extracted PDF text length:", pdfText.length, "chars");
  // Log first 500 chars for debugging
  console.log("PDF text preview:", pdfText.substring(0, 500));

  // Check if text is actually readable (not binary garbage from image PDFs)
  const readableChars = pdfText.replace(/[^a-zA-ZÀ-ÿ0-9\s.,;:!?@\-\/()]/g, "");
  const readableRatio = readableChars.length / Math.max(pdfText.length, 1);
  console.log("Readable ratio:", readableRatio.toFixed(2), "readable chars:", readableChars.length);

  if (pdfText.length < 20 || readableRatio < 0.3) {
    if (allowFallback) {
      console.log("PDF appears to be image-based, signaling AI fallback");
      return new Response(
        JSON.stringify({ auto_fallback_ai: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ error: "Não foi possível extrair texto do PDF. O documento pode ser escaneado/imagem. Tente a opção com IA.", method: "regex", updated: 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const extractedData = extractWithRegex(pdfText);
  console.log("Regex extracted:", JSON.stringify(extractedData));

  // Only update empty fields
  const updateData: Record<string, string> = {};
  for (const [key, value] of Object.entries(extractedData)) {
    if (!profile[key as keyof typeof profile] && value && value.trim()) {
      updateData[key] = value.trim();
    }
  }

  if (Object.keys(updateData).length === 0) {
    if (allowFallback) {
      console.log("Regex found no new data, signaling AI fallback");
      return new Response(
        JSON.stringify({ auto_fallback_ai: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ success: true, error: "Nenhum dado novo encontrado ou todos os campos já estão preenchidos.", updated: 0, method: "regex" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update(updateData)
    .eq("user_id", caseData.client_user_id);

  if (updateError) {
    console.error("Update error:", updateError);
    return new Response(JSON.stringify({ error: "Erro ao atualizar perfil." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ success: true, updated: Object.keys(updateData).length, fields: updateData, method: "regex" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ── AI-based extraction (uses credits) ──

async function extractAndUpdateProfileAI(
  admin: any, lovableKey: string, caseId: string, docBase64: string, docMimeType: string, corsHeaders: Record<string, string>
) {
  const { data: caseData } = await admin
    .from("cases")
    .select("client_user_id")
    .eq("id", caseId)
    .single();
  if (!caseData?.client_user_id) {
    return new Response(
      JSON.stringify({ error: "Este processo não possui um cliente vinculado." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("cpf, rg, address, phone, email, civil_status, nacionalidade, naturalidade, nome_mae, nome_pai, birth_date, cnh, ctps, pis, titulo_eleitor, atividade_economica")
    .eq("user_id", caseData.client_user_id)
    .single();

  if (!profile) {
    return new Response(
      JSON.stringify({ error: "Perfil do cliente não encontrado." }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const emptyFields: string[] = [];
  const fieldLabels: Record<string, string> = {
    cpf: "CPF", rg: "RG", address: "Endereço completo", phone: "Telefone",
    email: "Email", civil_status: "Estado civil", nacionalidade: "Nacionalidade",
    naturalidade: "Naturalidade", nome_mae: "Nome da mãe", nome_pai: "Nome do pai",
    birth_date: "Data de nascimento (YYYY-MM-DD)", cnh: "CNH", ctps: "CTPS",
    pis: "PIS/PASEP", titulo_eleitor: "Título de eleitor", atividade_economica: "Profissão",
  };

  for (const [key, label] of Object.entries(fieldLabels)) {
    if (!profile[key as keyof typeof profile]) {
      emptyFields.push(`${key}: ${label}`);
    }
  }

  if (emptyFields.length === 0) {
    return new Response(
      JSON.stringify({ error: "Todos os campos do cliente já estão preenchidos.", updated: 0, method: "ai" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const systemPrompt = `Você é um assistente jurídico brasileiro. Extraia dados de qualificação a partir do documento.
Retorne APENAS os campos que encontrar, no formato JSON.
Campos para buscar:
${emptyFields.map((f) => `- ${f}`).join("\n")}
Regras:
- CPF: formato XXX.XXX.XXX-XX
- Data de nascimento: formato YYYY-MM-DD
- Estado civil: solteiro, casado, divorciado, viúvo, união estável
- Retorne um objeto JSON com as chaves dos campos`;

  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: [
        { text: systemPrompt },
        { inline_data: { mime_type: docMimeType, data: docBase64 } },
      ]}],
      tools: [{
        type: "function",
        function: {
          name: "extract_client_data",
          description: "Extract client data from document",
          parameters: {
            type: "object",
            properties: {
              cpf: { type: "string" }, rg: { type: "string" }, address: { type: "string" },
              phone: { type: "string" }, email: { type: "string" }, civil_status: { type: "string" },
              nacionalidade: { type: "string" }, naturalidade: { type: "string" },
              nome_mae: { type: "string" }, nome_pai: { type: "string" },
              birth_date: { type: "string" }, cnh: { type: "string" }, ctps: { type: "string" },
              pis: { type: "string" }, titulo_eleitor: { type: "string" },
              atividade_economica: { type: "string" },
            },
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "extract_client_data" } },
    }),
  });

  if (!aiResponse.ok) {
    const errText = await aiResponse.text();
    console.error("AI error:", aiResponse.status, errText);
    if (aiResponse.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace em Settings → Workspace → Usage." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResponse.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Erro ao processar documento com IA." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const aiResult = await aiResponse.json();
  let extractedData: Record<string, string> = {};
  const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    try {
      extractedData = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments) : toolCall.function.arguments;
    } catch { console.error("Failed to parse tool call arguments"); }
  }

  const updateData: Record<string, string> = {};
  const emptyFieldKeys = emptyFields.map((f) => f.split(":")[0]);
  for (const [key, value] of Object.entries(extractedData)) {
    if (value && typeof value === "string" && value.trim() && emptyFieldKeys.includes(key)) {
      updateData[key] = value.trim();
    }
  }

  if (Object.keys(updateData).length === 0) {
    return new Response(
      JSON.stringify({ error: "Nenhum dado novo encontrado.", updated: 0, method: "ai" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update(updateData)
    .eq("user_id", caseData.client_user_id);

  if (updateError) {
    console.error("Update error:", updateError);
    return new Response(JSON.stringify({ error: "Erro ao atualizar perfil." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ success: true, updated: Object.keys(updateData).length, fields: updateData, method: "ai" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ── Auto-identify (AI only - needs to find the person) ──

async function handleAutoIdentify(
  admin: any, lovableKey: string, docBase64: string, docMimeType: string, docName: string, corsHeaders: Record<string, string>
) {
  const identifyPrompt = `Você é um assistente jurídico brasileiro. Analise este documento e extraia TODOS os dados de qualificação das partes envolvidas.

Retorne um JSON com os seguintes campos (apenas os que encontrar):
- full_name: Nome completo da parte (autor/requerente/cliente - NÃO o advogado)
- cpf: CPF no formato XXX.XXX.XXX-XX
- rg: RG
- address: Endereço completo
- phone: Telefone com DDD
- email: Email
- civil_status: Estado civil
- nacionalidade: Nacionalidade
- naturalidade: Naturalidade (cidade/estado)
- nome_mae: Nome da mãe
- nome_pai: Nome do pai
- birth_date: Data de nascimento (YYYY-MM-DD)
- cnh: CNH
- ctps: CTPS
- pis: PIS/PASEP
- titulo_eleitor: Título de eleitor
- atividade_economica: Profissão/Atividade econômica

IMPORTANTE: Identifique a PARTE (autor, requerente, reclamante), não o advogado.`;

  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: [
        { text: identifyPrompt },
        { inline_data: { mime_type: docMimeType, data: docBase64 } },
      ]}],
      tools: [{
        type: "function",
        function: {
          name: "extract_all_data",
          description: "Extract all client data from the document",
          parameters: {
            type: "object",
            properties: {
              full_name: { type: "string" }, cpf: { type: "string" }, rg: { type: "string" },
              address: { type: "string" }, phone: { type: "string" }, email: { type: "string" },
              civil_status: { type: "string" }, nacionalidade: { type: "string" },
              naturalidade: { type: "string" }, nome_mae: { type: "string" },
              nome_pai: { type: "string" }, birth_date: { type: "string" },
              cnh: { type: "string" }, ctps: { type: "string" }, pis: { type: "string" },
              titulo_eleitor: { type: "string" }, atividade_economica: { type: "string" },
            },
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "extract_all_data" } },
    }),
  });

  if (!aiResponse.ok) {
    const errText = await aiResponse.text();
    console.error("AI error:", aiResponse.status, errText);
    if (aiResponse.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResponse.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace em Settings → Workspace → Usage." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Erro ao processar documento com IA." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const aiResult = await aiResponse.json();
  let extractedData: Record<string, string> = {};
  const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    try {
      extractedData = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments) : toolCall.function.arguments;
    } catch { console.error("Failed to parse tool call arguments"); }
  }

  const extractedName = extractedData.full_name?.trim();
  const extractedCpf = extractedData.cpf?.replace(/\D/g, "");

  if (!extractedName && !extractedCpf) {
    return new Response(
      JSON.stringify({ error: "Não foi possível identificar o nome ou CPF da parte no documento." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let matchedProfile: any = null;
  if (extractedCpf) {
    const { data: cpfMatches } = await admin
      .from("profiles")
      .select("user_id, full_name, cpf, rg, address, phone, email, civil_status, nacionalidade, naturalidade, nome_mae, nome_pai, birth_date, cnh, ctps, pis, titulo_eleitor, atividade_economica")
      .ilike("cpf", `%${extractedCpf}%`);
    if (cpfMatches && cpfMatches.length > 0) matchedProfile = cpfMatches[0];
  }

  if (!matchedProfile && extractedName) {
    const nameParts = extractedName.split(" ").filter((p: string) => p.length > 2);
    if (nameParts.length >= 2) {
      const firstName = nameParts[0];
      const lastName = nameParts[nameParts.length - 1];
      const { data: nameMatches } = await admin
        .from("profiles")
        .select("user_id, full_name, cpf, rg, address, phone, email, civil_status, nacionalidade, naturalidade, nome_mae, nome_pai, birth_date, cnh, ctps, pis, titulo_eleitor, atividade_economica")
        .ilike("full_name", `%${firstName}%${lastName}%`);
      if (nameMatches && nameMatches.length === 1) matchedProfile = nameMatches[0];
      else if (nameMatches && nameMatches.length > 1) {
        const exactMatch = nameMatches.find((p: any) => p.full_name.toLowerCase().trim() === extractedName.toLowerCase().trim());
        matchedProfile = exactMatch || nameMatches[0];
      }
    }
    if (!matchedProfile) {
      const { data: fullNameMatches } = await admin
        .from("profiles")
        .select("user_id, full_name, cpf, rg, address, phone, email, civil_status, nacionalidade, naturalidade, nome_mae, nome_pai, birth_date, cnh, ctps, pis, titulo_eleitor, atividade_economica")
        .ilike("full_name", `%${extractedName}%`);
      if (fullNameMatches && fullNameMatches.length > 0) matchedProfile = fullNameMatches[0];
    }
  }

  if (!matchedProfile) {
    return new Response(
      JSON.stringify({
        error: `Cliente não encontrado no sistema. Nome: "${extractedName || 'N/A'}", CPF: "${extractedData.cpf || 'N/A'}".`,
        extracted_name: extractedName,
        extracted_cpf: extractedData.cpf,
      }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const fieldKeys = ["cpf", "rg", "address", "phone", "email", "civil_status", "nacionalidade", "naturalidade", "nome_mae", "nome_pai", "birth_date", "cnh", "ctps", "pis", "titulo_eleitor", "atividade_economica"];
  const updateData: Record<string, string> = {};
  for (const key of fieldKeys) {
    const currentValue = matchedProfile[key as keyof typeof matchedProfile];
    const newValue = extractedData[key];
    if (!currentValue && newValue && typeof newValue === "string" && newValue.trim()) {
      updateData[key] = newValue.trim();
    }
  }

  if (Object.keys(updateData).length === 0) {
    return new Response(
      JSON.stringify({ success: true, error: "Nenhum dado novo encontrado ou todos os campos já estão preenchidos.", updated: 0, client_name: matchedProfile.full_name }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update(updateData)
    .eq("user_id", matchedProfile.user_id);

  if (updateError) {
    console.error("Update error:", updateError);
    return new Response(JSON.stringify({ error: "Erro ao atualizar perfil do cliente." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ success: true, updated: Object.keys(updateData).length, fields: updateData, client_name: matchedProfile.full_name }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
