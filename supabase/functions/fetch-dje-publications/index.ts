const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userId = user.id;

    const { data: userProfile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', userId)
      .single();

    if (!userProfile?.tenant_id) {
      return new Response(JSON.stringify({ error: 'Perfil não encontrado.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const tenantId = userProfile.tenant_id;

    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: profiles } = await serviceClient
      .from('profiles')
      .select('oab_number, user_id')
      .eq('tenant_id', tenantId)
      .not('oab_number', 'is', null);

    const oabNumbers = (profiles || [])
      .map(p => normalizeOab(p.oab_number))
      .filter(oab => oab && oab.length >= 4);

    if (oabNumbers.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum número da OAB cadastrado no escritório. Configure nas Configurações.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`OABs encontradas: ${oabNumbers.join(', ')}`);

    const results: any[] = [];

    for (const oab of oabNumbers) {
      console.log(`Buscando notas de expediente TRF4 para OAB: ${oab}`);
      try {
        const pubs = await fetchTrf4NotasExpediente(oab, tenantId);
        results.push(...pubs);
        console.log(`TRF4: ${pubs.length} notas encontradas para ${oab}`);
      } catch (err) {
        console.error(`Erro TRF4 para ${oab}:`, err);
      }
    }

    // Store results
    if (results.length > 0) {
      for (const pub of results) {
        const { error: insertError } = await serviceClient
          .from('dje_publications')
          .upsert(pub, { onConflict: 'unique_hash' });
        if (insertError) {
          console.error('Insert error:', insertError.message);
        }
      }

      for (const pub of results) {
        await serviceClient.from('notifications').insert({
          user_id: userId,
          title: `Nova nota de expediente - ${pub.source}`,
          body: pub.title.substring(0, 200),
          case_id: pub.case_id || null,
        }).then(() => {});
      }
    }

    return new Response(JSON.stringify({
      success: true,
      found: results.length,
      publications: results.map(r => ({ title: r.title, source: r.source, date: r.publication_date }))
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

// === TRF4: Search for notas de expediente by OAB ===
async function fetchTrf4NotasExpediente(oab: string, tenantId: string): Promise<any[]> {
  const baseUrl = 'https://www2.trf4.jus.br/trf4/diario';
  const searchPageUrl = `${baseUrl}/consulta_diario.php`;

  // Step 1: GET the search page to get cookies and find the DJE form
  const getResponse = await fetch(searchPageUrl, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
  });

  const cookies = getResponse.headers.get('set-cookie') || '';
  const pageHtml = await getResponse.text();
  console.log(`GET page: ${getResponse.status}, ${pageHtml.length} chars`);

  // Find ALL forms and their actions
  const formRegex = /<form[^>]*>([\s\S]*?)<\/form>/gi;
  let formMatch;
  let djeFormHtml = '';
  let djeFormAction = '';
  let formIndex = 0;

  while ((formMatch = formRegex.exec(pageHtml)) !== null) {
    const formTag = pageHtml.substring(formMatch.index, formMatch.index + 500);
    const actionMatch = formTag.match(/action="([^"]*)"/i);
    const action = actionMatch ? actionMatch[1] : '';
    const formContent = formMatch[1];
    
    console.log(`Form ${formIndex}: action="${action}", has oab fields: ${formContent.includes('oab1')}`);
    
    // The DJE form is the one that contains oab fields
    if (formContent.includes('oab1') || formContent.includes('name="oab')) {
      djeFormHtml = formContent;
      djeFormAction = action;
      console.log(`Found DJE form! Action: ${action}`);
    }
    formIndex++;
  }

  if (!djeFormHtml) {
    console.error('DJE form not found on page!');
    // Log section around 'oab' to find it
    const oabIdx = pageHtml.indexOf('oab');
    if (oabIdx > -1) {
      console.log(`OAB context: ${pageHtml.substring(Math.max(0, oabIdx - 200), oabIdx + 500)}`);
    }
    return [];
  }

  // Parse OAB field structure - the fields are oab1-oab7
  // For OAB "RS073679" (8 chars), the fields might be:
  // oab1=R, oab2=S, oab3=0, oab4=7, oab5=3, oab6=6, oab7=79
  // OR they might be structured differently
  // Let's look at the actual input elements to understand maxlength
  const oabFieldInfo: string[] = [];
  for (let i = 1; i <= 7; i++) {
    const fieldRegex = new RegExp(`<input[^>]*name="oab${i}"[^>]*>`, 'i');
    const fieldMatch = djeFormHtml.match(fieldRegex);
    if (fieldMatch) {
      const maxLengthMatch = fieldMatch[0].match(/maxlength="(\d+)"/i);
      const sizeMatch = fieldMatch[0].match(/size="(\d+)"/i);
      oabFieldInfo.push(`oab${i}: maxlength=${maxLengthMatch?.[1] || '?'}, size=${sizeMatch?.[1] || '?'}`);
    }
  }
  console.log(`OAB fields: ${oabFieldInfo.join(', ')}`);

  // Extract hidden fields from the DJE form
  const hiddenFields: Record<string, string> = {};
  const hiddenRegex = /<input[^>]*type="hidden"[^>]*name="([^"]*)"[^>]*value="([^"]*)"[^>]*/gi;
  let hiddenMatch;
  while ((hiddenMatch = hiddenRegex.exec(djeFormHtml)) !== null) {
    hiddenFields[hiddenMatch[1]] = hiddenMatch[2];
  }

  // Build POST data
  const actionUrl = djeFormAction.startsWith('http')
    ? djeFormAction
    : djeFormAction.startsWith('/')
      ? `https://www2.trf4.jus.br${djeFormAction}`
      : `${baseUrl}/${djeFormAction.replace(/^\.\.\//, '../')}`.replace('/diario/../', '/');

  console.log(`Resolved action URL: ${actionUrl}`);

  const formData = new URLSearchParams();

  // Add hidden fields
  for (const [key, value] of Object.entries(hiddenFields)) {
    formData.append(key, value);
  }

  // Fill OAB fields character by character
  // OAB format: RS073679 = 8 chars for 7 fields
  // Likely: oab1=R, oab2=S, oab3=0, oab4=7, oab5=3, oab6=6, oab7=79
  // But let's check maxlength to determine proper splitting
  const oabChars = oab.split('');
  
  // Try splitting based on common TRF4 pattern:
  // The OAB input on TRF4 is typically a single visible field that
  // may be split by JS. Let's try the most common patterns:
  
  // Pattern: Each field = 1 char, but 8 chars / 7 fields means last field gets 2
  if (oabChars.length >= 7) {
    formData.append('oab1', oabChars[0]);
    formData.append('oab2', oabChars[1]);
    formData.append('oab3', oabChars[2]);
    formData.append('oab4', oabChars[3]);
    formData.append('oab5', oabChars[4]);
    formData.append('oab6', oabChars[5]);
    formData.append('oab7', oabChars.slice(6).join(''));
  }

  // Also add a single oab field in case it's a unified field
  formData.append('oab', oab);

  // Add publication type (Judicial)
  formData.append('tipo_publicacao', 'JU');

  // Add other fields
  formData.append('numero', '');
  formData.append('processo', '');
  formData.append('pesquisa_textual', '');

  console.log(`POST data: ${formData.toString().substring(0, 500)}`);

  const postResponse = await fetch(actionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'pt-BR,pt;q=0.9',
      'Origin': 'https://www2.trf4.jus.br',
      'Referer': searchPageUrl,
      ...(cookies ? { 'Cookie': cookies.split(';')[0] } : {}),
    },
    body: formData.toString(),
  });

  const resultHtml = await postResponse.text();
  console.log(`POST response: ${postResponse.status}, ${resultHtml.length} chars`);

  // Log clean text of result
  const cleanText = resultHtml
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  console.log(`Result snippet: ${cleanText.substring(0, 1500)}`);

  return parseNotasExpediente(resultHtml, oab, tenantId);
}

function parseNotasExpediente(html: string, oabNumber: string, tenantId: string): any[] {
  const publications: any[] = [];

  // Look for result rows - TRF4 DJE results contain document entries
  // Pattern: rows with document type, process number, date, and link
  
  // Try to find result table or list
  const resultIndicators = [
    /documento[s]?\s*encontrado/i,
    /resultado[s]?\s*da\s*pesquisa/i,
    /registro[s]?\s*encontrado/i,
    /exibe_documento/i,
  ];

  let hasResults = false;
  for (const indicator of resultIndicators) {
    if (indicator.test(html)) {
      hasResults = true;
      console.log(`Found result indicator: ${indicator.source}`);
      break;
    }
  }

  // Extract document entries by looking for links to documents
  const docRegex = /<a[^>]*href="([^"]*exibe_documento[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let docMatch;

  while ((docMatch = docRegex.exec(html)) !== null) {
    const href = docMatch[1];
    const linkText = docMatch[2].replace(/<[^>]+>/g, '').trim();

    if (!linkText || linkText.length < 3) continue;

    // Get surrounding context (the table row or containing element)
    const contextStart = Math.max(0, docMatch.index - 500);
    const contextEnd = Math.min(html.length, docMatch.index + docMatch[0].length + 500);
    const context = html.substring(contextStart, contextEnd).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    const processMatch = context.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
    const dateMatch = context.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    const pubDate = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : new Date().toISOString().split('T')[0];

    let pubType = 'Nota de Expediente';
    for (const tp of [
      { pattern: /despacho/i, type: 'Despacho' },
      { pattern: /decisão|decisao/i, type: 'Decisão' },
      { pattern: /sentença|sentenca/i, type: 'Sentença' },
      { pattern: /intimação|intimacao/i, type: 'Intimação' },
      { pattern: /ato\s*ordinat[óo]rio/i, type: 'Ato Ordinatório' },
      { pattern: /certid[ãa]o/i, type: 'Certidão' },
    ]) {
      if (tp.pattern.test(context)) {
        pubType = tp.type;
        break;
      }
    }

    const externalUrl = href.startsWith('http') ? href : `https://www2.trf4.jus.br${href}`;
    const hash = `trf4_${oabNumber}_${pubDate}_${simpleHash(linkText + href)}`;

    publications.push({
      tenant_id: tenantId,
      oab_number: oabNumber,
      source: 'TRF4',
      publication_date: pubDate,
      title: linkText.substring(0, 300),
      content: context.substring(0, 5000),
      publication_type: pubType,
      process_number: processMatch?.[1] || null,
      organ: 'TRF4',
      unique_hash: hash,
      external_url: externalUrl,
    });
  }

  // Also try download.php links (DJE edition PDFs that contain OAB mentions)
  if (publications.length === 0) {
    const dlRegex = /<a[^>]*href="([^"]*download\.php[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let dlMatch;

    while ((dlMatch = dlRegex.exec(html)) !== null) {
      const href = dlMatch[1];
      const linkText = dlMatch[2].replace(/<[^>]+>/g, '').trim();
      if (!linkText || linkText.length < 3) continue;
      // Skip if it's just edition listings without search context
      if (/^Edi[çc][ãa]o/i.test(linkText) && !html.includes('encontrad')) continue;

      const contextStart = Math.max(0, dlMatch.index - 500);
      const contextEnd = Math.min(html.length, dlMatch.index + dlMatch[0].length + 500);
      const context = html.substring(contextStart, contextEnd).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

      const processMatch = context.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
      const dateMatch = context.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      const pubDate = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : new Date().toISOString().split('T')[0];

      const externalUrl = href.startsWith('http') ? href : `https://www2.trf4.jus.br/trf4/diario/${href}`;
      const hash = `trf4_${oabNumber}_${pubDate}_${simpleHash(linkText + href)}`;

      publications.push({
        tenant_id: tenantId,
        oab_number: oabNumber,
        source: 'TRF4',
        publication_date: pubDate,
        title: linkText.substring(0, 300),
        content: context.substring(0, 5000),
        publication_type: 'Publicação DJE',
        process_number: processMatch?.[1] || null,
        organ: 'TRF4',
        unique_hash: hash,
        external_url: externalUrl,
      });
    }
  }

  return publications;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function normalizeOab(raw: string | null): string {
  if (!raw) return '';
  const clean = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const withoutOab = clean.replace(/^OAB/, '');

  const match = withoutOab.match(/^([A-Z]{2})(\d+)$/);
  if (match) {
    return `${match[1]}${match[2].padStart(6, '0')}`;
  }

  const match2 = withoutOab.match(/^(\d+)([A-Z]{2})$/);
  if (match2) {
    return `${match2[2]}${match2[1].padStart(6, '0')}`;
  }

  return withoutOab;
}
