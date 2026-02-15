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

    // Fetch publications directly via HTTP POST to TRF4 (no Firecrawl needed)
    const results = await fetchDirectFromTRF4(oabNumbers, tenantId);

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

async function fetchDirectFromTRF4(oabNumbers: string[], tenantId: string): Promise<any[]> {
  // Build form params for TRF4 DJE search
  // tipo_publicacao: 1=Administrativa, 2=Judicial I, 3=Judicial II
  // We search Judicial II (tipo_publicacao=3) which uses OAB numbers
  const params = new URLSearchParams();
  params.set('tipo_publicacao', '3');
  params.set('docsPagina', '50');
  
  // TRF4 accepts oab1 through oab7
  oabNumbers.slice(0, 7).forEach((oab, i) => {
    params.set(`oab${i + 1}`, oab);
  });

  // The form posts to this URL - the search button is type="button" and uses JS,
  // but the form action itself works with a direct POST
  const url = 'https://www.trf4.jus.br/trf4/diario/resultado_consulta.php';
  console.log(`POST ${url} with params: ${params.toString()}`);

  try {
    // First, GET the search page to establish a session/cookies
    const sessionResp = await fetch('https://www.trf4.jus.br/trf4/diario/consulta_diario.php', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    
    // Extract cookies from the session response
    const cookies = sessionResp.headers.getSetCookie?.() || [];
    const cookieString = cookies.map(c => c.split(';')[0]).join('; ');
    console.log(`Session cookies: ${cookieString || '(none)'}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Referer': 'https://www.trf4.jus.br/trf4/diario/consulta_diario.php',
        'Origin': 'https://www.trf4.jus.br',
        ...(cookieString ? { 'Cookie': cookieString } : {}),
      },
      body: params.toString(),
    });

    console.log(`TRF4 response status: ${response.status}`);
    const html = await response.text();
    console.log(`TRF4 response length: ${html.length} chars`);

    // Log snippet for debugging
    const cleanText = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    console.log(`Result snippet: ${cleanText.substring(0, 500)}`);

    const hasNoResults = /Nenhum documento encontrado|Informe ao menos/i.test(cleanText);
    if (hasNoResults) {
      console.log('No documents found for these OAB numbers');
      return [];
    }

    return parseResults(html, oabNumbers, tenantId);
  } catch (err) {
    console.error('TRF4 fetch error:', err);
    return [];
  }
}

function parseResults(html: string, oabNumbers: string[], tenantId: string): any[] {
  const publications: any[] = [];

  // Strategy 1: Look for exibe_documento links (main result format)
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

  // Strategy 2: Parse table rows
  if (publications.length === 0) {
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch;

    while ((trMatch = trRegex.exec(html)) !== null) {
      const row = trMatch[1];
      const rowText = row.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (rowText.length < 20) continue;

      // Extract date
      const dateMatch = rowText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (!dateMatch) continue;
      const pubDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;

      // Extract link if present
      const linkMatch = row.match(/<a[^>]*href="([^"]*)"[^>]*>/i);
      const externalUrl = linkMatch?.[1]
        ? (linkMatch[1].startsWith('http') ? linkMatch[1] : `https://www2.trf4.jus.br/trf4/diario/${linkMatch[1]}`)
        : null;

      // Extract organ/unit info
      const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
      const cellTexts = cells.map(c => c.replace(/<[^>]+>/g, '').trim());

      let pubType = cellTexts[3] || 'Publicação';
      const organ = cellTexts[1] || 'TRF4';

      const hash = `trf4_${oabNumbers[0]}_${pubDate}_${simpleHash(rowText.substring(0, 200))}`;

      if (publications.some(p => p.unique_hash === hash)) continue;

      publications.push({
        tenant_id: tenantId,
        oab_number: oabNumbers[0],
        source: 'TRF4',
        publication_date: pubDate,
        title: rowText.substring(0, 300),
        content: rowText.substring(0, 5000),
        publication_type: pubType,
        process_number: null,
        organ,
        unique_hash: hash,
        external_url: externalUrl,
      });
    }
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

  const externalUrl = href.startsWith('http') ? href : `https://www2.trf4.jus.br/trf4/diario/${href}`;
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
