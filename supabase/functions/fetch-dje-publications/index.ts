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
  // Step 1: GET the search page to obtain cookies and form structure
  const baseUrl = 'https://www2.trf4.jus.br/trf4/diario';
  const searchPageUrl = `${baseUrl}/consulta_diario.php`;
  
  const getResponse = await fetch(searchPageUrl, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    },
  });

  const cookies = getResponse.headers.get('set-cookie') || '';
  const pageHtml = await getResponse.text();
  
  console.log(`GET page: ${getResponse.status}, ${pageHtml.length} chars`);

  // Extract form action URL from HTML
  const formActionMatch = pageHtml.match(/<form[^>]*action="([^"]*)"[^>]*>/i);
  const formAction = formActionMatch ? formActionMatch[1] : 'consulta_diario.php';
  console.log(`Form action: ${formAction}`);
  
  // Extract any hidden fields
  const hiddenFields: Record<string, string> = {};
  const hiddenRegex = /<input[^>]*type="hidden"[^>]*name="([^"]*)"[^>]*value="([^"]*)"[^>]*/gi;
  let hiddenMatch;
  while ((hiddenMatch = hiddenRegex.exec(pageHtml)) !== null) {
    hiddenFields[hiddenMatch[1]] = hiddenMatch[2];
    console.log(`Hidden field: ${hiddenMatch[1]}=${hiddenMatch[2]}`);
  }

  // Extract form field names from the page
  const inputNames: string[] = [];
  const inputRegex = /<input[^>]*name="([^"]*)"[^>]*/gi;
  let inputMatch;
  while ((inputMatch = inputRegex.exec(pageHtml)) !== null) {
    inputNames.push(inputMatch[1]);
  }
  const selectNames: string[] = [];
  const selectRegex = /<select[^>]*name="([^"]*)"[^>]*/gi;
  let selectMatch;
  while ((selectMatch = selectRegex.exec(pageHtml)) !== null) {
    selectNames.push(selectMatch[1]);
  }
  console.log(`Input fields: ${inputNames.join(', ')}`);
  console.log(`Select fields: ${selectNames.join(', ')}`);

  // Step 2: POST the search form with OAB number
  const actionUrl = formAction.startsWith('http') ? formAction : `${baseUrl}/${formAction}`;
  
  const formData = new URLSearchParams();
  // Add hidden fields
  for (const [key, value] of Object.entries(hiddenFields)) {
    formData.append(key, value);
  }
  // Add OAB search
  formData.append('txtOAB', oab);
  formData.append('txtNumero', '');
  formData.append('txtProcesso', '');
  formData.append('txtQtdPorPagina', '50');
  
  // Select "Judicial" publication type for notas de expediente
  if (selectNames.includes('selPublicacao')) {
    formData.append('selPublicacao', 'JU');
  }
  if (selectNames.includes('selOrigem')) {
    formData.append('selOrigem', '');
  }
  if (selectNames.includes('selTipo')) {
    formData.append('selTipo', '');
  }

  console.log(`POST to: ${actionUrl}`);
  console.log(`Form data: ${formData.toString().substring(0, 500)}`);

  const postResponse = await fetch(actionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      'Origin': 'https://www2.trf4.jus.br',
      'Referer': searchPageUrl,
      ...(cookies ? { 'Cookie': cookies.split(';')[0] } : {}),
    },
    body: formData.toString(),
  });

  const resultHtml = await postResponse.text();
  console.log(`POST response: ${postResponse.status}, ${resultHtml.length} chars`);
  
  // Log a meaningful snippet of the result to debug
  // Remove scripts, styles, etc. and find the main content
  const cleanText = resultHtml
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  console.log(`Clean result (first 1000 chars): ${cleanText.substring(0, 1000)}`);
  
  // Parse the results
  return parseNotasExpediente(resultHtml, oab, tenantId);
}

function parseNotasExpediente(html: string, oabNumber: string, tenantId: string): any[] {
  const publications: any[] = [];
  
  // Look for result entries - TRF4 DJE search results typically have:
  // - Document title/type
  // - Process number
  // - Publication date
  // - Link to the document
  
  // Pattern 1: Look for result table rows with document info
  // The TRF4 search results usually contain tables with document entries
  const resultSectionMatch = html.match(/resultado[s]?\s*da\s*pesquisa|documento[s]?\s*encontrado[s]?|registros?\s*encontrado/i);
  if (resultSectionMatch) {
    console.log('Found results section indicator');
  }

  // Extract individual document entries
  // Pattern: links to exibe_documento.php or download.php with surrounding context
  const docLinkRegex = /(?:<tr[^>]*>[\s\S]*?)?<a[^>]*href="([^"]*(?:exibe_documento|download)[^"]*)"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)(?:<\/tr>|<br|<\/td>)/gi;
  let docMatch;
  
  while ((docMatch = docLinkRegex.exec(html)) !== null) {
    const href = docMatch[1];
    const linkText = docMatch[2].replace(/<[^>]+>/g, '').trim();
    const context = docMatch[3].replace(/<[^>]+>/g, '').trim();
    
    if (!linkText || linkText.length < 3) continue;
    // Skip edition links (we want document-level results, not edition PDFs)
    if (/^Edi[çc][ãa]o\s+(Judicial|Administrativ)/i.test(linkText)) continue;
    
    const fullText = `${linkText} ${context}`;
    
    // Extract process number
    const processMatch = fullText.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
    
    // Extract date
    let pubDate = new Date().toISOString().split('T')[0];
    const dateMatch = fullText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (dateMatch) {
      pubDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
    }
    
    // Determine type
    let pubType = 'Nota de Expediente';
    const typePatterns = [
      { pattern: /despacho/i, type: 'Despacho' },
      { pattern: /decisão|decisao/i, type: 'Decisão' },
      { pattern: /sentença|sentenca/i, type: 'Sentença' },
      { pattern: /intimação|intimacao/i, type: 'Intimação' },
      { pattern: /acórdão|acordao/i, type: 'Acórdão' },
      { pattern: /ato\s*ordinat/i, type: 'Ato Ordinatório' },
      { pattern: /certidão|certidao/i, type: 'Certidão' },
      { pattern: /edital/i, type: 'Edital' },
    ];
    for (const tp of typePatterns) {
      if (tp.pattern.test(fullText)) {
        pubType = tp.type;
        break;
      }
    }

    const externalUrl = href.startsWith('http') ? href : `https://www2.trf4.jus.br/trf4/diario/${href}`;
    const hash = `trf4_${oabNumber}_${pubDate}_${simpleHash(linkText + href)}`;

    publications.push({
      tenant_id: tenantId,
      oab_number: oabNumber,
      source: 'TRF4',
      publication_date: pubDate,
      title: linkText.substring(0, 300),
      content: fullText.substring(0, 5000),
      publication_type: pubType,
      process_number: processMatch?.[1] || null,
      organ: 'TRF4',
      unique_hash: hash,
      external_url: externalUrl,
    });
  }

  // Pattern 2: If no document links found, try parsing text blocks
  if (publications.length === 0) {
    console.log('No document links found, trying text block parsing...');
    
    // Look for structured content blocks that contain OAB mentions
    // The search results might show text excerpts from the DJE
    const textBlocks = html.split(/<hr|<br\s*\/?>\s*<br|<\/tr>/i);
    
    for (const block of textBlocks) {
      const text = block.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text.length < 50) continue;
      
      // Only include blocks that mention the OAB number or process numbers
      const oabClean = oabNumber.replace(/^([A-Z]{2})0*/, '$1');
      if (!text.includes(oabNumber) && !text.includes(oabClean) && !/\d{7}-\d{2}\.\d{4}/.test(text)) continue;
      
      const processMatch = text.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
      const dateMatch = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      const pubDate = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : new Date().toISOString().split('T')[0];
      
      let pubType = 'Nota de Expediente';
      for (const tp of [
        { pattern: /despacho/i, type: 'Despacho' },
        { pattern: /decisão|decisao/i, type: 'Decisão' },
        { pattern: /sentença|sentenca/i, type: 'Sentença' },
        { pattern: /intimação|intimacao/i, type: 'Intimação' },
        { pattern: /ato\s*ordinat/i, type: 'Ato Ordinatório' },
      ]) {
        if (tp.pattern.test(text)) {
          pubType = tp.type;
          break;
        }
      }
      
      const title = text.substring(0, 200).trim();
      const hash = `trf4_${oabNumber}_${pubDate}_${simpleHash(title)}`;
      
      // Find any link in the original block
      const linkMatch = block.match(/href="([^"]*(?:exibe_documento|download)[^"]*)"/i);
      const externalUrl = linkMatch 
        ? (linkMatch[1].startsWith('http') ? linkMatch[1] : `https://www2.trf4.jus.br/trf4/diario/${linkMatch[1]}`)
        : null;

      publications.push({
        tenant_id: tenantId,
        oab_number: oabNumber,
        source: 'TRF4',
        publication_date: pubDate,
        title,
        content: text.substring(0, 5000),
        publication_type: pubType,
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
