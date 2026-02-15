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

    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: userProfile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', userId)
      .single();

    if (!userProfile?.tenant_id) {
      return new Response(JSON.stringify({ error: 'Perfil não encontrado.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const tenantId = userProfile.tenant_id;

    const { data: profiles } = await serviceClient
      .from('profiles')
      .select('oab_number, user_id')
      .eq('tenant_id', tenantId)
      .not('oab_number', 'is', null);

    const oabNumbers = (profiles || [])
      .map(p => normalizeOab(p.oab_number))
      .filter(oab => oab && oab.length >= 4);

    if (oabNumbers.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum número da OAB cadastrado no escritório.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`OABs encontradas: ${oabNumbers.join(', ')}`);

    const results: any[] = [];

    // Strategy: POST to consulta_diario.php with tipo_publicacao=3 (Judicial II)
    // The form fields oab1-oab7 only work with Judicial II publications
    const pubs = await fetchTrf4Publications(oabNumbers, tenantId);
    results.push(...pubs);

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
          title: `Nova publicação - ${pub.publication_type || pub.source}`,
          body: pub.title.substring(0, 200),
          case_id: pub.case_id || null,
        }).then(() => {});
      }
    }

    return new Response(JSON.stringify({
      success: true,
      found: results.length,
      publications: results.map(r => ({ title: r.title, source: r.source, date: r.publication_date, type: r.publication_type }))
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

async function fetchTrf4Publications(oabNumbers: string[], tenantId: string): Promise<any[]> {
  const formPageUrl = 'https://www.trf4.jus.br/trf4/diario/consulta_diario.php';

  // Step 1: GET the form page to obtain session cookies
  console.log('Step 1: GET form page for cookies...');
  const getResponse = await fetch(formPageUrl, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });

  const cookies = getResponse.headers.get('set-cookie') || '';
  const cookieStr = cookies.split(',').map(c => c.split(';')[0].trim()).filter(Boolean).join('; ');
  console.log(`GET response: ${getResponse.status}, cookies: ${cookieStr ? 'yes' : 'none'}`);

  // Step 2: POST to the SAME form page with correct parameters
  // tipo_publicacao=3 is "Judicial II" (current active judicial publications)
  // The form action says resultado_consulta.php but that URL returns 404
  // The real processing happens when POSTing back to consulta_diario.php
  const formData = new URLSearchParams();
  formData.append('tipo_publicacao', '3'); // Judicial II - THIS IS THE KEY FIX (was 'JU' before)

  // Fill OAB slots (up to 7)
  for (let i = 0; i < 7; i++) {
    formData.append(`oab${i + 1}`, i < oabNumbers.length ? oabNumbers[i] : '');
  }

  formData.append('orgao', '');
  formData.append('localidade', '');
  formData.append('unidade', '');
  formData.append('serie_jud', '');
  formData.append('serie_adm', '');
  formData.append('serie_comp_jud', '');
  formData.append('data_ini', '');
  formData.append('data_fim', '');
  formData.append('numero', '');
  formData.append('processo', '');
  formData.append('docsPagina', '100');

  console.log(`Step 2: POST to ${formPageUrl}`);
  console.log(`Form: tipo_publicacao=3, oab1=${oabNumbers[0]}, oab2=${oabNumbers[1] || ''}`);

  const postResponse = await fetch(formPageUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Origin': 'https://www.trf4.jus.br',
      'Referer': formPageUrl,
      ...(cookieStr ? { 'Cookie': cookieStr } : {}),
    },
    body: formData.toString(),
  });

  const resultHtml = await postResponse.text();
  console.log(`POST response: ${postResponse.status}, ${resultHtml.length} chars`);

  // Log a clean text snippet to see what we got
  const cleanText = resultHtml
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Look for indicators of search results vs just the form
  const hasSearchResults = /Resultado da Pesquisa|documentos? encontrados?|Nenhum documento|exibe_documento/i.test(resultHtml);
  const hasOabMention = oabNumbers.some(oab => cleanText.includes(oab) || cleanText.includes(oab.replace(/^([A-Z]{2})0*/, '$1')));

  console.log(`Has search results indicators: ${hasSearchResults}`);
  console.log(`Has OAB mention: ${hasOabMention}`);
  console.log(`Clean text snippet (chars 3000-5000): ${cleanText.substring(3000, 5000)}`);

  // Parse results - look for exibe_documento links (individual documents)
  const publications = parseSearchResults(resultHtml, oabNumbers, tenantId);

  if (publications.length === 0) {
    console.log('No specific publications found from POST. Trying alternative: download edition PDFs...');
    // Fallback: try to get the latest edition and find OAB mentions
    const editionPubs = await tryEditionPdfFallback(resultHtml, oabNumbers, tenantId);
    publications.push(...editionPubs);
  }

  return publications;
}

function parseSearchResults(html: string, oabNumbers: string[], tenantId: string): any[] {
  const publications: any[] = [];

  // Look for exibe_documento links - these are individual publication entries
  const docRegex = /<a[^>]*href="([^"]*exibe_documento[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = docRegex.exec(html)) !== null) {
    const href = match[1];
    const linkText = match[2].replace(/<[^>]+>/g, '').trim();
    if (!linkText || linkText.length < 3) continue;

    // Skip if it's just an edition link
    if (/^Edi[çc][ãa]o\s+(Judicial|Administrativ)/i.test(linkText)) continue;

    const contextStart = Math.max(0, match.index - 1000);
    const contextEnd = Math.min(html.length, match.index + match[0].length + 1000);
    const context = html.substring(contextStart, contextEnd).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    const processMatch = context.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
    const dateMatch = context.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    const pubDate = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : new Date().toISOString().split('T')[0];

    let pubType = 'Publicação';
    for (const tp of [
      { pattern: /ato\s*ordinat[óo]rio/i, type: 'Ato Ordinatório' },
      { pattern: /despacho/i, type: 'Despacho' },
      { pattern: /decis[ãa]o/i, type: 'Decisão' },
      { pattern: /senten[çc]a/i, type: 'Sentença' },
      { pattern: /intima[çc][ãa]o/i, type: 'Intimação' },
      { pattern: /ac[óo]rd[ãa]o/i, type: 'Acórdão' },
    ]) {
      if (tp.pattern.test(context)) { pubType = tp.type; break; }
    }

    let matchedOab = oabNumbers[0];
    for (const o of oabNumbers) {
      if (context.includes(o)) { matchedOab = o; break; }
    }

    const externalUrl = href.startsWith('http') ? href : `https://www.trf4.jus.br/trf4/diario/${href}`;
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

  // Also look for table rows with publication data (common DJE format)
  // Pattern: <tr> containing process number, type, and content
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const row = trMatch[1];
    const rowText = row.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    // Check if this row mentions any of our OAB numbers
    const mentionsOab = oabNumbers.some(oab => rowText.includes(oab));
    if (!mentionsOab) continue;

    // Check if this looks like a publication row (has process number or publication type)
    const processMatch = rowText.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
    if (!processMatch) continue;

    // Avoid duplicates
    const existingProcess = publications.some(p => p.process_number === processMatch[1]);
    if (existingProcess) continue;

    const dateMatch = rowText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    const pubDate = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : new Date().toISOString().split('T')[0];

    let pubType = 'Publicação';
    for (const tp of [
      { pattern: /ato\s*ordinat[óo]rio/i, type: 'Ato Ordinatório' },
      { pattern: /despacho/i, type: 'Despacho' },
      { pattern: /decis[ãa]o/i, type: 'Decisão' },
      { pattern: /senten[çc]a/i, type: 'Sentença' },
      { pattern: /intima[çc][ãa]o/i, type: 'Intimação' },
      { pattern: /ac[óo]rd[ãa]o/i, type: 'Acórdão' },
    ]) {
      if (tp.pattern.test(rowText)) { pubType = tp.type; break; }
    }

    let matchedOab = oabNumbers[0];
    for (const o of oabNumbers) {
      if (rowText.includes(o)) { matchedOab = o; break; }
    }

    const hash = `trf4_${matchedOab}_${pubDate}_${simpleHash(rowText)}`;
    const title = rowText.length > 100 ? rowText.substring(0, 100) + '...' : rowText;

    publications.push({
      tenant_id: tenantId,
      oab_number: matchedOab,
      source: 'TRF4',
      publication_date: pubDate,
      title,
      content: rowText.substring(0, 5000),
      publication_type: pubType,
      process_number: processMatch[1],
      organ: 'TRF4',
      unique_hash: hash,
      external_url: null,
    });
  }

  console.log(`Parsed ${publications.length} publications from search results`);
  return publications;
}

async function tryEditionPdfFallback(formHtml: string, oabNumbers: string[], tenantId: string): Promise<any[]> {
  // Extract download links for Judicial II editions from the form page
  const downloadRegex = /href="([^"]*download\.php\?id_publicacao=\d+)"[^>]*>[\s\S]*?<b>(Edi[çc][ãa]o Judicial[^<]*)<\/b>/gi;
  let match;
  const editionLinks: { url: string; name: string }[] = [];

  while ((match = downloadRegex.exec(formHtml)) !== null) {
    // Only get Judicial editions (not Administrative)
    if (/judicial/i.test(match[2]) && !/administrativa/i.test(match[2])) {
      const url = match[1].startsWith('http') ? match[1] : `https://www.trf4.jus.br/trf4/diario/${match[1]}`;
      editionLinks.push({ url, name: match[2].trim() });
    }
  }

  console.log(`Found ${editionLinks.length} Judicial edition links for PDF fallback`);

  // We won't actually download PDFs (too heavy for edge functions)
  // Instead, log what we found so the user knows the scraping approach doesn't work
  if (editionLinks.length === 0) {
    console.log('No Judicial edition links found. The TRF4 DJE search requires JavaScript execution which is not available in edge functions.');
    console.log('Consider using an alternative data source or API for OAB-specific publications.');
  }

  return [];
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
