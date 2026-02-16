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
    const { document_id, case_id, process_number, file_base64, file_name, file_mime_type } = await req.json();
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

    const authHeader = req.headers.get("authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;

    const admin = createClient(supabaseUrl, serviceKey);

    // Resolve case_id from process_number if needed
    let resolvedCaseId = case_id;
    if (!resolvedCaseId && process_number) {
      // Clean process number - remove formatting
      const cleanNumber = process_number.replace(/\D/g, "");
      
      // Try exact match first, then cleaned match
      const { data: cases } = await admin
        .from("cases")
        .select("id, client_user_id, process_number")
        .or(`process_number.eq.${process_number},process_number.eq.${cleanNumber}`);
      
      if (!cases || cases.length === 0) {
        // Try partial match
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
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    // Get case to find client
    const { data: caseData } = await admin
      .from("cases")
      .select("client_user_id")
      .eq("id", resolvedCaseId)
      .single();
    if (!caseData?.client_user_id) {
      return new Response(
        JSON.stringify({ error: "Este processo não possui um cliente vinculado." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get current profile to know which fields are empty
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

    // Find empty fields
    const emptyFields: string[] = [];
    const fieldLabels: Record<string, string> = {
      cpf: "CPF",
      rg: "RG",
      address: "Endereço completo",
      phone: "Telefone",
      email: "Email",
      civil_status: "Estado civil",
      nacionalidade: "Nacionalidade",
      naturalidade: "Naturalidade (cidade/estado)",
      nome_mae: "Nome da mãe",
      nome_pai: "Nome do pai",
      birth_date: "Data de nascimento (formato YYYY-MM-DD)",
      cnh: "CNH",
      ctps: "CTPS",
      pis: "PIS/PASEP",
      titulo_eleitor: "Título de eleitor",
      atividade_economica: "Profissão/Atividade econômica",
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

    // Build AI request
    const systemPrompt = `Você é um assistente jurídico brasileiro. Extraia dados de qualificação de uma parte processual a partir do documento fornecido.

Retorne APENAS os campos que conseguir encontrar no documento, no formato JSON. Não invente dados.

Campos para buscar (retorne apenas os que encontrar):
${emptyFields.map((f) => `- ${f}`).join("\n")}

Regras:
- CPF: formato XXX.XXX.XXX-XX
- RG: como aparecer no documento
- Endereço: completo com rua, número, bairro, cidade, estado e CEP
- Telefone: com DDD
- Data de nascimento: formato YYYY-MM-DD
- Estado civil: solteiro, casado, divorciado, viúvo, união estável
- Retorne um objeto JSON com as chaves sendo os nomes dos campos (cpf, rg, address, etc.)`;

    const parts: any[] = [{ text: systemPrompt }];
    parts.push({
      inline_data: {
        mime_type: docMimeType,
        data: docBase64,
      },
    });
    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: parts,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extract_client_data",
                description: "Extract client qualification data from a legal document",
                parameters: {
                  type: "object",
                  properties: {
                    cpf: { type: "string", description: "CPF no formato XXX.XXX.XXX-XX" },
                    rg: { type: "string", description: "RG" },
                    address: { type: "string", description: "Endereço completo" },
                    phone: { type: "string", description: "Telefone com DDD" },
                    email: { type: "string", description: "Email" },
                    civil_status: { type: "string", description: "Estado civil" },
                    nacionalidade: { type: "string", description: "Nacionalidade" },
                    naturalidade: { type: "string", description: "Naturalidade" },
                    nome_mae: { type: "string", description: "Nome da mãe" },
                    nome_pai: { type: "string", description: "Nome do pai" },
                    birth_date: { type: "string", description: "Data de nascimento YYYY-MM-DD" },
                    cnh: { type: "string", description: "CNH" },
                    ctps: { type: "string", description: "CTPS" },
                    pis: { type: "string", description: "PIS/PASEP" },
                    titulo_eleitor: { type: "string", description: "Título de eleitor" },
                    atividade_economica: { type: "string", description: "Profissão/Atividade econômica" },
                  },
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "extract_client_data" } },
        }),
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "Erro ao processar documento com IA." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await aiResponse.json();
    console.log("AI result:", JSON.stringify(aiResult));

    let extractedData: Record<string, string> = {};

    // Parse tool call response
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

    // Filter to only update empty fields
    const updateData: Record<string, string> = {};
    const emptyFieldKeys = emptyFields.map((f) => f.split(":")[0]);

    for (const [key, value] of Object.entries(extractedData)) {
      if (value && typeof value === "string" && value.trim() && emptyFieldKeys.includes(key)) {
        updateData[key] = value.trim();
      }
    }

    if (Object.keys(updateData).length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhum dado novo encontrado no documento.", updated: 0, extracted: extractedData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update profile
    const { error: updateError } = await admin
      .from("profiles")
      .update(updateData)
      .eq("user_id", caseData.client_user_id);

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
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Extract error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
