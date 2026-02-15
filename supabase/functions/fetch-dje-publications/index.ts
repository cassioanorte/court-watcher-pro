const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.48/deno-dom-wasm.ts";

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
      console.log(`Buscando publicações TRF4 para OAB: ${oab}`);
      try {
        const pubs = await fetchTrf4Publications(oab, tenantId);
        results.push(...pubs);
        console.log(`TRF4: ${pubs.length} publicações encontradas para ${oab}`);
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
          title: `Nova publicação DJE - ${pub.source}`,
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

// === TRF4: Direct POST to the search form ===
async function fetchTrf4Publications(oab: string, tenantId: string): Promise<any[]> {
  const url = 'https://www2.trf4.jus.br/trf4/diario/exibe_documento.php';
  
  // First, try the search form with POST
  const formData = new URLSearchParams();
  formData.append('txtOAB', oab);
  formData.append('selOrigem', '');
  formData.append('txtNumero', '');
  formData.append('txtProcesso', '');
  formData.append('selTipo', '');
  formData.append('hdnInicio', '0');
  formData.append('txtQtdPorPagina', '50');
  formData.append('hdnOrderBy', '');

  const searchUrl = 'https://www2.trf4.jus.br/trf4/diario/consulta_diario.php';
  
  const response = await fetch(searchUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'pt-BR,pt;q=0.9',
      'Origin': 'https://www2.trf4.jus.br',
      'Referer': 'https://www2.trf4.jus.br/trf4/diario/consulta_diario.php',
    },
    body: formData.toString(),
  });

  const html = await response.text();
  console.log(`TRF4 response: ${response.status}, ${html.length} chars`);
  
  // Log a snippet to debug
  const snippet = html.substring(0, 1000);
  console.log(`TRF4 snippet: ${snippet.substring(0, 500)}`);

  return parseTrf4Html(html, oab, tenantId);
}

function parseTrf4Html(html: string, oabNumber: string, tenantId: string): any[] {
  const publications: any[] = [];

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (!doc) return publications;

    // Look for result rows - TRF4 typically uses tables for results
    const tables = doc.querySelectorAll('table');
    console.log(`Found ${tables.length} tables in TRF4 response`);
    
    // Try to find publication entries in the HTML
    // TRF4 results usually have links to documents with publication info
    const links = doc.querySelectorAll('a[href*="download.php"], a[href*="exibe_documento"]');
    console.log(`Found ${links.length} document links`);

    // Also try to parse based on common patterns in the raw HTML
    // Look for rows with publication data
    const rows = doc.querySelectorAll('tr');
    
    for (const row of rows) {
      const cells = row.querySelectorAll('td');
      if (cells.length < 2) continue;
      
      const rowText = row.textContent?.trim() || '';
      if (rowText.length < 20) continue;
      
      // Skip header rows and navigation
      if (rowText.includes('Documentos por Página') || rowText.includes('Todas as edições')) continue;
      
      // Look for edition links
      const link = row.querySelector('a[href*="download.php"], a[href*="exibe_documento"]');
      if (!link) continue;
      
      const linkText = link.textContent?.trim() || '';
      const href = link.getAttribute('href') || '';
      
      if (!linkText || linkText.length < 5) continue;
      
      // Extract date from context if possible
      let pubDate = new Date().toISOString().split('T')[0];
      const dateMatch = rowText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (dateMatch) {
        pubDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
      }

      // Determine publication type
      let pubType = 'Publicação';
      const typePatterns = [
        { pattern: /judicial/i, type: 'Judicial' },
        { pattern: /administrativ/i, type: 'Administrativa' },
        { pattern: /despacho/i, type: 'Despacho' },
        { pattern: /decisão/i, type: 'Decisão' },
        { pattern: /sentença/i, type: 'Sentença' },
        { pattern: /intimação/i, type: 'Intimação' },
        { pattern: /acórdão/i, type: 'Acórdão' },
      ];
      for (const tp of typePatterns) {
        if (tp.pattern.test(linkText) || tp.pattern.test(rowText)) {
          pubType = tp.type;
          break;
        }
      }

      // Extract process number if present
      const processMatch = rowText.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
      
      const externalUrl = href.startsWith('http') ? href : `https://www2.trf4.jus.br/trf4/diario/${href}`;

      const hash = `trf4_${oabNumber}_${pubDate}_${simpleHash(linkText + href)}`;

      publications.push({
        tenant_id: tenantId,
        oab_number: oabNumber,
        source: 'TRF4',
        publication_date: pubDate,
        title: linkText.substring(0, 300),
        content: rowText.substring(0, 5000),
        publication_type: pubType,
        process_number: processMatch?.[1] || null,
        organ: 'TRF4',
        unique_hash: hash,
        external_url: externalUrl,
      });
    }

    // If no table results, try regex-based parsing on raw HTML
    if (publications.length === 0) {
      console.log('No table results, trying regex parsing...');
      
      // Look for patterns like "Edição Judicial nº XX" or document references
      const editionRegex = /Edi[çc][ãa]o\s+(Judicial|Administrativ[ao]|Extraordin[áa]ri[ao])\s+(?:n[ºo]\s*)?(\d+)/gi;
      let match;
      const seen = new Set<string>();
      
      while ((match = editionRegex.exec(html)) !== null) {
        const edType = match[1];
        const edNum = match[2];
        const key = `${edType}_${edNum}`;
        if (seen.has(key)) continue;
        seen.add(key);
        
        // Find nearby date
        const context = html.substring(Math.max(0, match.index - 200), match.index + 200);
        const dateMatch = context.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        const pubDate = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : new Date().toISOString().split('T')[0];
        
        // Find nearby download link
        const linkMatch = context.match(/href="([^"]*download\.php[^"]*)"/);
        const externalUrl = linkMatch 
          ? (linkMatch[1].startsWith('http') ? linkMatch[1] : `https://www2.trf4.jus.br/trf4/diario/${linkMatch[1]}`)
          : null;

        const title = `Edição ${edType} nº ${edNum}`;
        const hash = `trf4_${oabNumber}_${pubDate}_${simpleHash(title)}`;

        publications.push({
          tenant_id: tenantId,
          oab_number: oabNumber,
          source: 'TRF4',
          publication_date: pubDate,
          title,
          content: `Publicação no Diário Eletrônico - ${title}`,
          publication_type: edType.includes('Judicial') ? 'Judicial' : 'Administrativa',
          process_number: null,
          organ: 'TRF4',
          unique_hash: hash,
          external_url: externalUrl,
        });
      }
    }
  } catch (parseError) {
    console.error('Parse error:', parseError);
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
