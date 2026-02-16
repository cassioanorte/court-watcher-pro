const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { document_id, case_id, process_number, file_base64, file_name, file_mime_type, auto_identify } = await req.json();
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Auto-identify mode: extract data first, then find client
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
      docBase64 = btoa(String.fromCharCode(...docBytes));
      docMimeType = contentType.includes("pdf") || doc.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : contentType.split(";")[0] || "image/jpeg";
      docName = doc.name;
    }

    return await extractAndUpdateProfile(admin, lovableKey, resolvedCaseId, docBase64, docMimeType, corsHeaders);
  } catch (err) {
    console.error("Extract error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleAutoIdentify(
  admin: any, lovableKey: string, docBase64: string, docMimeType: string, docName: string, corsHeaders: Record<string, string>
) {
  // Step 1: Extract ALL possible data from the document, including name and CPF for identification
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

IMPORTANTE: Identifique a PARTE (autor, requerente, reclamante), não o advogado. O nome completo é essencial para identificação.`;

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
              full_name: { type: "string" },
              cpf: { type: "string" },
              rg: { type: "string" },
              address: { type: "string" },
              phone: { type: "string" },
              email: { type: "string" },
              civil_status: { type: "string" },
              nacionalidade: { type: "string" },
              naturalidade: { type: "string" },
              nome_mae: { type: "string" },
              nome_pai: { type: "string" },
              birth_date: { type: "string" },
              cnh: { type: "string" },
              ctps: { type: "string" },
              pis: { type: "string" },
              titulo_eleitor: { type: "string" },
              atividade_economica: { type: "string" },
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
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } catch {
      console.error("Failed to parse tool call arguments");
    }
  }

  console.log("Extracted data for identification:", JSON.stringify(extractedData));

  const extractedName = extractedData.full_name?.trim();
  const extractedCpf = extractedData.cpf?.replace(/\D/g, "");

  if (!extractedName && !extractedCpf) {
    return new Response(
      JSON.stringify({ error: "Não foi possível identificar o nome ou CPF da parte no documento." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Step 2: Find matching client in profiles
  let matchedProfile: any = null;

  // Try CPF match first (most reliable)
  if (extractedCpf) {
    const { data: cpfMatches } = await admin
      .from("profiles")
      .select("user_id, full_name, cpf, rg, address, phone, email, civil_status, nacionalidade, naturalidade, nome_mae, nome_pai, birth_date, cnh, ctps, pis, titulo_eleitor, atividade_economica")
      .ilike("cpf", `%${extractedCpf}%`);
    
    if (cpfMatches && cpfMatches.length > 0) {
      matchedProfile = cpfMatches[0];
    }
  }

  // Try name match if CPF didn't work
  if (!matchedProfile && extractedName) {
    // Search by similar name
    const nameParts = extractedName.split(" ").filter((p: string) => p.length > 2);
    
    if (nameParts.length >= 2) {
      // Use first and last name for matching
      const firstName = nameParts[0];
      const lastName = nameParts[nameParts.length - 1];
      
      const { data: nameMatches } = await admin
        .from("profiles")
        .select("user_id, full_name, cpf, rg, address, phone, email, civil_status, nacionalidade, naturalidade, nome_mae, nome_pai, birth_date, cnh, ctps, pis, titulo_eleitor, atividade_economica")
        .ilike("full_name", `%${firstName}%${lastName}%`);
      
      if (nameMatches && nameMatches.length === 1) {
        matchedProfile = nameMatches[0];
      } else if (nameMatches && nameMatches.length > 1) {
        // Multiple matches - try exact match
        const exactMatch = nameMatches.find((p: any) => 
          p.full_name.toLowerCase().trim() === extractedName.toLowerCase().trim()
        );
        matchedProfile = exactMatch || nameMatches[0];
      }
    }
    
    // If still no match, try full name
    if (!matchedProfile) {
      const { data: fullNameMatches } = await admin
        .from("profiles")
        .select("user_id, full_name, cpf, rg, address, phone, email, civil_status, nacionalidade, naturalidade, nome_mae, nome_pai, birth_date, cnh, ctps, pis, titulo_eleitor, atividade_economica")
        .ilike("full_name", `%${extractedName}%`);
      
      if (fullNameMatches && fullNameMatches.length > 0) {
        matchedProfile = fullNameMatches[0];
      }
    }
  }

  if (!matchedProfile) {
    return new Response(
      JSON.stringify({ 
        error: `Cliente não encontrado no sistema. Nome identificado: "${extractedName || 'N/A'}", CPF: "${extractedData.cpf || 'N/A'}". Verifique se o cliente está cadastrado.`,
        extracted_name: extractedName,
        extracted_cpf: extractedData.cpf,
      }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Step 3: Update only empty fields
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
      JSON.stringify({ 
        success: true,
        error: "Nenhum dado novo encontrado ou todos os campos já estão preenchidos.", 
        updated: 0, 
        client_name: matchedProfile.full_name,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update(updateData)
    .eq("user_id", matchedProfile.user_id);

  if (updateError) {
    console.error("Update error:", updateError);
    return new Response(
      JSON.stringify({ error: "Erro ao atualizar perfil do cliente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      updated: Object.keys(updateData).length,
      fields: updateData,
      client_name: matchedProfile.full_name,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function extractAndUpdateProfile(
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
      JSON.stringify({ error: "Todos os campos do cliente já estão preenchidos.", updated: 0 }),
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
    console.error("AI error:", aiResponse.status, await aiResponse.text());
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
      JSON.stringify({ error: "Nenhum dado novo encontrado.", updated: 0 }),
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
    JSON.stringify({ success: true, updated: Object.keys(updateData).length, fields: updateData }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
