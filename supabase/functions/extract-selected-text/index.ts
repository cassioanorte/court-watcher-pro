const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// ── Regex extraction from plain text ──
function extractWithRegex(text: string): Record<string, string> {
  const data: Record<string, string> = {};

  // CPF: 000.000.000-00
  const cpfMatch = text.match(/\b(\d{3}[.\s]?\d{3}[.\s]?\d{3}[-.\s]?\d{2})\b/);
  if (cpfMatch) {
    const raw = cpfMatch[1].replace(/\s/g, "").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(raw)) data.cpf = raw;
  }

  // RG
  const rgMatch = text.match(/(?:RG|R\.G\.|Identidade|Carteira de Identidade)[:\s]*[nº°]*\s*([\d.\-\/]+)/i);
  if (rgMatch) {
    const rgClean = rgMatch[1].replace(/[^0-9]/g, "");
    if (rgClean.length >= 4) data.rg = rgMatch[1].trim();
  }

  // Address
  const addrPatterns = [
    /(?:residente|domiciliado|morador|endereço|reside)[a-z\s]*(?:na|em|à|no)\s+(.+?)(?:,\s*(?:CEP|nesta|portador|inscrit|brasileir|solteiro|casado|divorciado|viúv|natural|\d{5}-?\d{3}))/is,
    /(?:Rua|Avenida|Av\.|Travessa|Alameda|Rodovia|Estrada|Praça)\s+[^,]+,\s*(?:n[.ºo°]*\s*\d+[^,]*,\s*)?[^,]+(?:,\s*[^,]+)?(?:,\s*\w{2})?(?:\s*[-–]\s*CEP\s*\d{5}-?\d{3})?/i,
  ];
  for (const pattern of addrPatterns) {
    const m = text.match(pattern);
    if (m) {
      const addr = (m[1] || m[0]).replace(/\s+/g, " ").trim();
      if (addr.length > 10 && addr.length < 300) { data.address = addr; break; }
    }
  }

  // Phone
  const phoneMatch = text.match(/\(?\d{2}\)?\s*9?\d{4}[-.\s]?\d{4}/);
  if (phoneMatch) data.phone = phoneMatch[0].trim();

  // Email
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) data.email = emailMatch[0].toLowerCase();

  // Civil status
  const civilMatch = text.match(/\b(solteiro|solteira|casado|casada|divorciado|divorciada|viúvo|viúva|separado|separada|união\s+estável)\b/i);
  if (civilMatch) {
    const raw = civilMatch[1].toLowerCase();
    if (raw.includes("solteir")) data.civil_status = "Solteiro(a)";
    else if (raw.includes("casad")) data.civil_status = "Casado(a)";
    else if (raw.includes("divorci")) data.civil_status = "Divorciado(a)";
    else if (raw.includes("viúv")) data.civil_status = "Viúvo(a)";
    else if (raw.includes("separad")) data.civil_status = "Separado(a)";
    else if (raw.includes("união")) data.civil_status = "União Estável";
  }

  // Nationality
  const nacMatch = text.match(/\b(brasileir[oa]|estrangeir[oa]|portugues[a]?|italian[oa]|argentin[oa])\b/i);
  if (nacMatch) data.nacionalidade = nacMatch[1].charAt(0).toUpperCase() + nacMatch[1].slice(1).toLowerCase();

  // Birth place
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

  // Birth date
  const datePatterns = [
    /(?:nascid[oa]?\s+em|data\s+de\s+nascimento|nascimento)[:\s]*(\d{2})[\/.-](\d{2})[\/.-](\d{4})/i,
    /(\d{2})[\/.-](\d{2})[\/.-](\d{4})/,
  ];
  for (const pattern of datePatterns) {
    const dateMatch = text.match(pattern);
    if (dateMatch) {
      const [, d, m, y] = dateMatch;
      const yr = parseInt(y);
      if (yr >= 1920 && yr <= 2010) { data.birth_date = `${y}-${m}-${d}`; break; }
    }
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

  // Certidão Reservista
  const reservistaMatch = text.match(/(?:Certidão\s+(?:de\s+)?Reservista|Certificado\s+(?:de\s+)?Reservista)[:\s]*[nº°]*\s*(\d[\d.\-\/]+\d)/i);
  if (reservistaMatch) data.certidao_reservista = reservistaMatch[1].trim();

  // Passaporte
  const passaporteMatch = text.match(/(?:Passaporte)[:\s]*[nº°]*\s*([A-Z]{2}\d{6,})/i);
  if (passaporteMatch) data.passaporte = passaporteMatch[1].trim();

  return data;
}

// ── Main handler ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { selected_text, contact_user_id, preview_only } = body;

    if (!selected_text || typeof selected_text !== "string" || selected_text.trim().length < 5) {
      return new Response(
        JSON.stringify({ success: false, error: "Nenhum texto selecionado ou texto muito curto." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract data from the selected text
    const extracted = extractWithRegex(selected_text.trim());

    if (Object.keys(extracted).length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Nenhum dado reconhecido no texto selecionado. Tente selecionar um trecho com CPF, RG, endereço ou outros dados de qualificação." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Preview mode: just return found data without updating
    if (preview_only || !contact_user_id) {
      return new Response(
        JSON.stringify({ success: true, preview: true, fields: extracted, count: Object.keys(extracted).length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update mode: update the profile
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Get current profile to only update empty fields
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("cpf, rg, address, phone, email, civil_status, nacionalidade, naturalidade, nome_mae, nome_pai, birth_date, cnh, ctps, pis, titulo_eleitor, atividade_economica, certidao_reservista, passaporte, full_name")
      .eq("user_id", contact_user_id)
      .single();

    if (profileError || !profile) {
      // Try to identify by CPF if no contact_user_id match
      if (extracted.cpf) {
        const { data: cpfProfile } = await admin
          .from("profiles")
          .select("user_id, full_name")
          .eq("cpf", extracted.cpf)
          .single();
        
        if (cpfProfile) {
          return new Response(
            JSON.stringify({ 
              success: true, 
              preview: true, 
              fields: extracted, 
              count: Object.keys(extracted).length,
              identified_contact: { user_id: cpfProfile.user_id, name: cpfProfile.full_name }
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      return new Response(
        JSON.stringify({ success: false, error: "Contato não encontrado." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only update fields that are currently empty
    const updates: Record<string, string> = {};
    for (const [key, value] of Object.entries(extracted)) {
      if (!profile[key as keyof typeof profile]) {
        updates[key] = value;
      }
    }

    if (Object.keys(updates).length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          updated: 0, 
          fields: extracted, 
          message: "Todos os campos encontrados já estão preenchidos.",
          client_name: profile.full_name 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: updateError } = await admin
      .from("profiles")
      .update(updates)
      .eq("user_id", contact_user_id);

    if (updateError) {
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao atualizar perfil: " + updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        updated: Object.keys(updates).length, 
        fields: updates, 
        all_found: extracted,
        client_name: profile.full_name 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Extract selected text error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
