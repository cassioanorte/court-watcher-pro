const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Busca publicações nos Diários de Justiça Eletrônicos por número de OAB.
 * Usa Firecrawl para scraping com JavaScript rendering dos portais dos tribunais.
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization');

    if (!firecrawlKey) {
      return new Response(JSON.stringify({ error: 'Firecrawl não configurado.' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Determine tenants
    let isCron = false;
    let userId: string | null = null;
    let tenantIds: string[] = [];

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
        const { data: profile } = await supabase
          .from('profiles').select('tenant_id').eq('user_id', userId).single();
        if (profile?.tenant_id) tenantIds = [profile.tenant_id];
      }
    }

    if (tenantIds.length === 0) {
      isCron = true;
      console.log('🕐 CRON mode');
      const { data: tenants } = await serviceClient
        .from('tenants').select('id').is('blocked_at', null);
      tenantIds = (tenants || []).map((t: any) => t.id);
    }

    let totalFound = 0;

    for (const tenantId of tenantIds) {
      const { data: profiles } = await serviceClient
        .from('profiles')
        .select('user_id, full_name, oab_number')
        .eq('tenant_id', tenantId)
        .not('oab_number', 'is', null);

      const oabEntries = (profiles || [])
        .filter((p: any) => p.oab_number && p.oab_number.trim().length >= 4)
        .map((p: any) => ({
          user_id: p.user_id,
          full_name: p.full_name,
          oab_raw: p.oab_number,
          oab_formatted: formatOab(p.oab_number),
        }));

      if (oabEntries.length === 0) continue;

      console.log(`Tenant ${tenantId}: ${oabEntries.length} OABs: ${oabEntries.map((o: any) => o.oab_formatted).join(', ')}`);

      // Get cases for linking
      const { data: cases } = await serviceClient
        .from('cases').select('id, process_number').eq('tenant_id', tenantId);
      const caseMap: Record<string, string> = {};
      for (const c of (cases || [])) {
        caseMap[c.process_number.replace(/[^0-9]/g, '')] = c.id;
      }

      // Get notify users
      let notifyUserIds: string[] = [];
      if (userId && !isCron) {
        notifyUserIds = [userId];
      } else {
        const { data: tp } = await serviceClient
          .from('profiles').select('user_id').eq('tenant_id', tenantId);
        for (const p of (tp || [])) {
          const { data: roles } = await serviceClient
            .from('user_roles').select('role').eq('user_id', p.user_id).in('role', ['owner', 'staff']);
          if (roles && roles.length > 0) notifyUserIds.push(p.user_id);
        }
      }

      const allPubs: any[] = [];

      for (const oab of oabEntries) {
        // Search TRF4 DJE via Firecrawl
        try {
          const pubs = await searchTRF4WithFirecrawl(firecrawlKey, oab, tenantId, caseMap);
          allPubs.push(...pubs);
          console.log(`TRF4 DJE for ${oab.oab_formatted}: ${pubs.length} publications`);
        } catch (err) {
          console.error(`TRF4 error for ${oab.oab_formatted}:`, err);
        }

        // Search TJRS DJE via Firecrawl
        try {
          const pubs = await searchTJRSWithFirecrawl(firecrawlKey, oab, tenantId, caseMap);
          allPubs.push(...pubs);
          console.log(`TJRS DJE for ${oab.oab_formatted}: ${pubs.length} publications`);
        } catch (err) {
          console.error(`TJRS error for ${oab.oab_formatted}:`, err);
        }
      }

      // Store publications
      if (allPubs.length > 0) {
        let inserted = 0;
        for (const pub of allPubs) {
          const { error } = await serviceClient
            .from('dje_publications')
            .upsert(pub, { onConflict: 'unique_hash' });
          if (!error) inserted++;
          else console.error('Insert error:', error.message);
        }

        for (const uid of notifyUserIds) {
          await serviceClient.from('notifications').insert({
            user_id: uid,
            title: `${allPubs.length} publicação(ões) encontrada(s) no DJE`,
            body: `Novas publicações vinculadas às OABs do escritório.`,
            case_id: null,
          });
        }

        console.log(`Tenant ${tenantId}: ${inserted} stored`);
        totalFound += allPubs.length;
      }
    }

    console.log(`✅ Done. ${totalFound} DJE publications`);

    return new Response(JSON.stringify({
      success: true, found: totalFound, tenants_processed: tenantIds.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

// ==================== TRF4 via Firecrawl ====================
async function searchTRF4WithFirecrawl(
  apiKey: string, oabEntry: any, tenantId: string, caseMap: Record<string, string>
): Promise<any[]> {
  // Use Firecrawl to scrape the TRF4 DJE search with OAB parameter
  // The TRF4 form uses JavaScript to submit, so we need Firecrawl's JS rendering
  const oab = oabEntry.oab_formatted;
  
  // The TRF4 DJE accepts direct URL params for searching
  // We'll scrape the consultation page with actions to fill and submit the form
  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: 'https://www.trf4.jus.br/trf4/diario/consulta_diario.php',
      formats: ['markdown'],
      waitFor: 3000,
      actions: [
        // Click on "Judicial II" radio button
        { type: 'click', selector: '#tipo_publicacao_C' },
        // Wait for OAB fields to appear
        { type: 'wait', milliseconds: 1000 },
        // Fill OAB field
        { type: 'write', selector: '#oab1', text: oab },
        // Set docs per page to 100
        { type: 'click', selector: '#docsPagina option[value="100"]' },
        // Click search button
        { type: 'click', selector: '#botaoPesquisar' },
        // Wait for results
        { type: 'wait', milliseconds: 5000 },
        // Take screenshot for debugging
        { type: 'screenshot' },
      ],
    }),
  });

  const data = await response.json();
  
  if (!data.success && !data.data) {
    console.error('Firecrawl TRF4 error:', JSON.stringify(data).substring(0, 500));
    return [];
  }

  const markdown = data.data?.markdown || data.markdown || '';
  const screenshot = data.data?.screenshot || data.screenshot || '';
  
  console.log(`TRF4 Firecrawl: ${markdown.length} chars markdown, screenshot: ${screenshot ? 'yes' : 'no'}`);
  
  if (markdown.length < 100) {
    console.log(`TRF4 markdown preview: ${markdown.substring(0, 500)}`);
    return [];
  }

  return parseDJEMarkdown(markdown, 'TRF4', oabEntry, tenantId, caseMap);
}

// ==================== TJRS via Firecrawl ====================
async function searchTJRSWithFirecrawl(
  apiKey: string, oabEntry: any, tenantId: string, caseMap: Record<string, string>
): Promise<any[]> {
  const oabMatch = oabEntry.oab_formatted.match(/^([A-Z]{2})(\d+)$/);
  if (!oabMatch) return [];

  const oabNum = oabMatch[2].replace(/^0+/, ''); // Remove leading zeros

  // TJRS uses Themis system - search by OAB
  // URL format: https://www.tjrs.jus.br/busca/?tb=proc
  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: `https://www.tjrs.jus.br/novo/busca/?return=proc&ession=&oab_tipo=A&oab_uf=${oabMatch[1]}&oab_num=${oabNum}`,
      formats: ['markdown'],
      waitFor: 5000,
    }),
  });

  const data = await response.json();
  
  if (!data.success && !data.data) {
    console.error('Firecrawl TJRS error:', JSON.stringify(data).substring(0, 500));
    return [];
  }

  const markdown = data.data?.markdown || data.markdown || '';
  console.log(`TJRS Firecrawl: ${markdown.length} chars`);

  if (markdown.length < 100) {
    console.log(`TJRS markdown preview: ${markdown.substring(0, 500)}`);
    return [];
  }

  return parseDJEMarkdown(markdown, 'TJRS', oabEntry, tenantId, caseMap);
}

// ==================== Parse DJE markdown ====================
function parseDJEMarkdown(
  markdown: string, tribunal: string, oabEntry: any,
  tenantId: string, caseMap: Record<string, string>
): any[] {
  const publications: any[] = [];
  const today = new Date().toISOString().split('T')[0];

  // Find all CNJ-format process numbers
  const procRegex = /(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/g;
  const processes: string[] = [];
  let match;
  while ((match = procRegex.exec(markdown)) !== null) {
    if (!processes.includes(match[1])) processes.push(match[1]);
  }

  console.log(`${tribunal}: found ${processes.length} unique process numbers`);

  const typeKeywords: [RegExp, string][] = [
    [/intima[çc][ãa]o|intimado/i, 'Intimação'],
    [/despacho/i, 'Despacho'],
    [/decis[ãa]o/i, 'Decisão'],
    [/senten[çc]a/i, 'Sentença'],
    [/ac[óo]rd[ãa]o/i, 'Acórdão'],
    [/ato\s*ordinat[óo]rio/i, 'Ato Ordinatório'],
    [/cita[çc][ãa]o/i, 'Citação'],
    [/peti[çc][ãa]o/i, 'Petição'],
    [/edital/i, 'Edital'],
  ];

  for (const proc of processes) {
    const procIdx = markdown.indexOf(proc);
    if (procIdx === -1) continue;

    const start = Math.max(0, procIdx - 300);
    const end = Math.min(markdown.length, procIdx + proc.length + 1500);
    const context = markdown.substring(start, end).trim();

    // Determine type
    let pubType = 'Publicação DJE';
    for (const [regex, name] of typeKeywords) {
      if (regex.test(context)) {
        pubType = name;
        break;
      }
    }

    // Extract date (DD/MM/YYYY)
    const dateRegex = /(\d{2})\/(\d{2})\/(\d{4})/g;
    let pubDate = today;
    let dMatch;
    while ((dMatch = dateRegex.exec(context)) !== null) {
      const year = parseInt(dMatch[3]);
      if (year >= 2024) {
        pubDate = `${dMatch[3]}-${dMatch[2]}-${dMatch[1]}`;
        break;
      }
    }

    const procClean = proc.replace(/[^0-9]/g, '');
    const caseId = caseMap[procClean] || null;
    const hash = `${tribunal.toLowerCase()}_dje_${procClean}_${pubDate}_${simpleHash(context.substring(0, 100))}`;

    const content = [
      `Processo: ${proc}`,
      `Tribunal: ${tribunal}`,
      `Advogado: ${oabEntry.full_name} (OAB ${oabEntry.oab_raw})`,
      `Data: ${pubDate}`,
      `Tipo: ${pubType}`,
      '',
      context.substring(0, 3000),
    ].join('\n');

    publications.push({
      tenant_id: tenantId,
      oab_number: oabEntry.oab_formatted,
      source: tribunal,
      publication_date: pubDate,
      title: `${pubType} - ${proc}`.substring(0, 300),
      content: content.substring(0, 5000),
      publication_type: pubType,
      process_number: proc,
      organ: tribunal,
      unique_hash: hash,
      external_url: null,
      case_id: caseId,
    });
  }

  return publications;
}

// ==================== Utilities ====================
function formatOab(raw: string): string {
  if (!raw) return '';
  const clean = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().replace(/^OAB/, '');
  const m1 = clean.match(/^([A-Z]{2})(\d+)$/);
  if (m1) return `${m1[1]}${m1[2].padStart(6, '0')}`;
  const m2 = clean.match(/^(\d+)([A-Z]{2})$/);
  if (m2) return `${m2[2]}${m2[1].padStart(6, '0')}`;
  return clean;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
