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

    const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

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

    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlKey) {
      return new Response(JSON.stringify({ error: 'Firecrawl não configurado.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Use Firecrawl to scrape TRF4 DJE search with JavaScript rendering
    const results = await fetchWithFirecrawl(firecrawlKey, oabNumbers, tenantId);

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

async function fetchWithFirecrawl(apiKey: string, oabNumbers: string[], tenantId: string): Promise<any[]> {
  // Build the TRF4 DJE search URL with parameters
  // The form uses JavaScript to submit, but we can use Firecrawl's actions feature
  // to fill the form and click the search button
  const searchUrl = 'https://www.trf4.jus.br/trf4/diario/consulta_diario.php';

  console.log(`Scraping ${searchUrl} with Firecrawl for OABs: ${oabNumbers.join(', ')}`);

  // Build JS script to fill form and submit programmatically
  // The OAB fields are hidden until "Judicial II" is selected via JS
  const oabAssignments = oabNumbers
    .slice(0, 7)
    .map((oab, i) => `document.getElementById('oab${i + 1}').value = '${oab}';`)
    .join('\n');

  const formScript = `
    // Select Judicial II radio
    document.getElementById('tipo_publicacao_C').click();
    // Show OAB fields (they are hidden by default)
    document.getElementById('processo_oab').style.display = '';
    // Fill OAB fields
    ${oabAssignments}
    // Submit the form
    document.forms['form'].submit();
  `;

  const actions = [
    { type: "executeJavascript", script: formScript },
    { type: "wait", milliseconds: 5000 },
  ];

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: searchUrl,
        formats: ['html', 'markdown'],
        waitFor: 2000,
        actions: actions,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Firecrawl error:', JSON.stringify(data));
      return [];
    }

    const html = data.data?.html || data.html || '';
    const markdown = data.data?.markdown || data.markdown || '';

    console.log(`Firecrawl response: ${html.length} chars HTML, ${markdown.length} chars markdown`);

    // Log a snippet to debug
    const cleanText = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    console.log(`Result snippet: ${cleanText.substring(0, 2000)}`);

    // Check for specific result indicators
    const hasResults = /exibe_documento|Resultado|documentos?\s+encontrados?/i.test(html);
    const hasNoResults = /Nenhum documento encontrado|Informe ao menos/i.test(cleanText);

    console.log(`Has results: ${hasResults}, No results: ${hasNoResults}`);

    if (hasNoResults) {
      console.log('No documents found for these OAB numbers');
      return [];
    }

    // Parse the results
    return parseResults(html, markdown, oabNumbers, tenantId);

  } catch (err) {
    console.error('Firecrawl fetch error:', err);
    return [];
  }
}

function parseResults(html: string, markdown: string, oabNumbers: string[], tenantId: string): any[] {
  const publications: any[] = [];

  // Strategy 1: Look for exibe_documento links
  const docRegex = /<a[^>]*href="([^"]*exibe_documento[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = docRegex.exec(html)) !== null) {
    const href = match[1];
    const linkText = match[2].replace(/<[^>]+>/g, '').trim();
    if (!linkText || linkText.length < 3) continue;
    if (/^Edi[çc][ãa]o\s+(Judicial|Administrativ)/i.test(linkText)) continue;

    const contextStart = Math.max(0, match.index - 1500);
    const contextEnd = Math.min(html.length, match.index + match[0].length + 1500);
    const context = html.substring(contextStart, contextEnd).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    const pub = buildPublication(href, linkText, context, oabNumbers, tenantId);
    if (pub) publications.push(pub);
  }

  // Strategy 2: Parse from markdown - look for process numbers with OAB context
  if (publications.length === 0 && markdown.length > 500) {
    // Split markdown into sections/paragraphs
    const sections = markdown.split(/\n{2,}/);

    for (const section of sections) {
      const processMatch = section.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
      const mentionsOab = oabNumbers.some(oab => section.includes(oab) || section.includes(oab.replace(/^([A-Z]{2})0*/, '$1')));

      if (processMatch && mentionsOab) {
        const dateMatch = section.match(/(\d{2})\/(\d{2})\/(\d{4})/);
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
          if (tp.pattern.test(section)) { pubType = tp.type; break; }
        }

        let matchedOab = oabNumbers[0];
        for (const o of oabNumbers) {
          if (section.includes(o)) { matchedOab = o; break; }
        }

        const title = section.substring(0, 200).replace(/\n/g, ' ').trim();
        const hash = `trf4_${matchedOab}_${pubDate}_${simpleHash(title + processMatch[1])}`;

        // Check for duplicate
        if (publications.some(p => p.unique_hash === hash)) continue;

        publications.push({
          tenant_id: tenantId,
          oab_number: matchedOab,
          source: 'TRF4',
          publication_date: pubDate,
          title: title.substring(0, 300),
          content: section.substring(0, 5000),
          publication_type: pubType,
          process_number: processMatch[1],
          organ: 'TRF4',
          unique_hash: hash,
          external_url: null,
        });
      }
    }
  }

  // Strategy 3: Parse table rows with OAB mentions
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const row = trMatch[1];
    const rowText = row.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    const mentionsOab = oabNumbers.some(oab => rowText.includes(oab));
    if (!mentionsOab) continue;

    const processMatch = rowText.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
    if (!processMatch) continue;

    if (publications.some(p => p.process_number === processMatch[1])) continue;

    const dateMatch = rowText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    const pubDate = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : new Date().toISOString().split('T')[0];

    let pubType = 'Publicação';
    for (const tp of [
      { pattern: /ato\s*ordinat[óo]rio/i, type: 'Ato Ordinatório' },
      { pattern: /despacho/i, type: 'Despacho' },
      { pattern: /decis[ãa]o/i, type: 'Decisão' },
      { pattern: /senten[çc]a/i, type: 'Sentença' },
      { pattern: /intima[çc][ãa]o/i, type: 'Intimação' },
    ]) {
      if (tp.pattern.test(rowText)) { pubType = tp.type; break; }
    }

    let matchedOab = oabNumbers[0];
    for (const o of oabNumbers) {
      if (rowText.includes(o)) { matchedOab = o; break; }
    }

    const hash = `trf4_${matchedOab}_${pubDate}_${simpleHash(rowText.substring(0, 200))}`;
    const title = rowText.length > 200 ? rowText.substring(0, 200) + '...' : rowText;

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

  console.log(`Parsed ${publications.length} publications total`);
  return publications;
}

function buildPublication(href: string, linkText: string, context: string, oabNumbers: string[], tenantId: string): any | null {
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

  return {
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
  };
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
