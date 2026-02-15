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

    // Try all possible TRF4 base URLs
    const baseUrls = [
      'https://www.trf4.jus.br/trf4/diario',
      'https://www2.trf4.jus.br/trf4/diario',
    ];

    for (const baseUrl of baseUrls) {
      console.log(`Tentando base URL: ${baseUrl}`);
      try {
        const pubs = await fetchTrf4NotasExpediente(oabNumbers, tenantId, baseUrl);
        if (pubs.length > 0) {
          results.push(...pubs);
          console.log(`Sucesso! ${pubs.length} notas encontradas em ${baseUrl}`);
          break; // Found results, stop trying other URLs
        }
      } catch (err) {
        console.error(`Erro com ${baseUrl}:`, err);
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

async function fetchTrf4NotasExpediente(oabNumbers: string[], tenantId: string, baseUrl: string): Promise<any[]> {
  const searchPageUrl = `${baseUrl}/consulta_diario.php`;

  // Step 1: GET the page to get cookies
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
  console.log(`GET ${searchPageUrl}: ${getResponse.status}, ${pageHtml.length} chars`);

  // Step 2: Build form data
  // oab1-oab7 are slots for up to 7 complete OAB numbers (maxlength=10 each)
  const formData = new URLSearchParams();
  
  // Fill OAB slots with our OAB numbers (up to 7)
  for (let i = 0; i < Math.min(oabNumbers.length, 7); i++) {
    formData.append(`oab${i + 1}`, oabNumbers[i]);
  }
  // Fill remaining slots empty
  for (let i = oabNumbers.length; i < 7; i++) {
    formData.append(`oab${i + 1}`, '');
  }

  // Select Judicial publication type
  formData.append('tipo_publicacao', 'JU');
  formData.append('numero', '');
  formData.append('processo', '');
  formData.append('pesquisa_textual', '');
  formData.append('docsPagina', '50');

  // Try multiple possible result URLs
  const resultUrls = [
    `${baseUrl}/resultado_consulta.php`,
    `${baseUrl}/pesquisa_resultado.php`,
    searchPageUrl, // POST back to itself
  ];

  for (const resultUrl of resultUrls) {
    console.log(`POST to: ${resultUrl}`);
    console.log(`Form data: ${formData.toString().substring(0, 300)}`);

    try {
      const postResponse = await fetch(resultUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'pt-BR,pt;q=0.9',
          'Origin': baseUrl.replace('/trf4/diario', ''),
          'Referer': searchPageUrl,
          ...(cookies ? { 'Cookie': cookies.split(';')[0] } : {}),
        },
        body: formData.toString(),
      });

      const resultHtml = await postResponse.text();
      console.log(`Response from ${resultUrl}: ${postResponse.status}, ${resultHtml.length} chars`);

      if (postResponse.status === 404 || resultHtml.length < 100) {
        console.log('Skipping - 404 or empty response');
        continue;
      }

      // Check if this looks like a results page (not just the form again)
      const cleanText = resultHtml
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      console.log(`Result snippet: ${cleanText.substring(0, 2000)}`);

      // Check for result indicators
      const hasResults = /encontrad|resultado|documento|exibe_documento|intimação|despacho|decisão|sentença|ato\s*ordinat/i.test(cleanText);
      const isJustForm = /Informe ao menos|P[áa]gina n[ãa]o encontrada|File not found/i.test(cleanText);

      if (isJustForm) {
        console.log('Page is just form/error, skipping');
        continue;
      }

      if (hasResults || resultHtml.length > 20000) {
        console.log('Found potential results page!');
        const pubs = parseNotasExpediente(resultHtml, oabNumbers, tenantId);
        if (pubs.length > 0) return pubs;
      }
    } catch (fetchErr) {
      console.error(`Error fetching ${resultUrl}:`, fetchErr);
    }
  }

  // Fallback: Try GET with query params
  const getSearchUrl = `${searchPageUrl}?oab1=${oabNumbers[0]}&tipo_publicacao=JU&docsPagina=50`;
  console.log(`Fallback GET: ${getSearchUrl}`);
  
  try {
    const getResult = await fetch(getSearchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
    });
    const getHtml = await getResult.text();
    console.log(`GET result: ${getResult.status}, ${getHtml.length} chars`);
    
    const cleanGet = getHtml
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    console.log(`GET snippet: ${cleanGet.substring(0, 1000)}`);
    
    const pubs = parseNotasExpediente(getHtml, oabNumbers, tenantId);
    if (pubs.length > 0) return pubs;
  } catch (e) {
    console.error('GET fallback error:', e);
  }

  return [];
}

function parseNotasExpediente(html: string, oabNumbers: string[], tenantId: string): any[] {
  const publications: any[] = [];
  const oab = oabNumbers[0]; // primary OAB for hashing

  // Look for document entries
  const docRegex = /<a[^>]*href="([^"]*(?:exibe_documento|download)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let docMatch;

  while ((docMatch = docRegex.exec(html)) !== null) {
    const href = docMatch[1];
    const linkText = docMatch[2].replace(/<[^>]+>/g, '').trim();
    if (!linkText || linkText.length < 3) continue;
    if (/^Edi[çc][ãa]o\s+(Judicial|Administrativ)/i.test(linkText)) continue;

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
      { pattern: /ato\s*ordinat/i, type: 'Ato Ordinatório' },
    ]) {
      if (tp.pattern.test(context)) { pubType = tp.type; break; }
    }

    // Determine which OAB this belongs to
    let matchedOab = oab;
    for (const o of oabNumbers) {
      if (context.includes(o) || context.includes(o.replace(/^([A-Z]{2})0*/, '$1'))) {
        matchedOab = o;
        break;
      }
    }

    const externalUrl = href.startsWith('http') ? href : `https://www2.trf4.jus.br/trf4/diario/${href}`;
    const hash = `trf4_${matchedOab}_${pubDate}_${simpleHash(linkText + href)}`;

    publications.push({
      tenant_id: tenantId,
      oab_number: matchedOab,
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
  if (match) return `${match[1]}${match[2].padStart(6, '0')}`;
  const match2 = withoutOab.match(/^(\d+)([A-Z]{2})$/);
  if (match2) return `${match2[2]}${match2[1].padStart(6, '0')}`;
  return withoutOab;
}
