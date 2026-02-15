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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization');

    if (!firecrawlKey) {
      return new Response(JSON.stringify({ error: 'Firecrawl não configurado.' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

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

      const { data: cases } = await serviceClient
        .from('cases').select('id, process_number').eq('tenant_id', tenantId);
      const caseMap: Record<string, string> = {};
      for (const c of (cases || [])) {
        caseMap[c.process_number.replace(/[^0-9]/g, '')] = c.id;
      }

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
        // TRF4 DJE via Firecrawl with corrected actions
        try {
          const pubs = await searchTRF4(firecrawlKey, oab, tenantId, caseMap);
          allPubs.push(...pubs);
          console.log(`TRF4 for ${oab.oab_formatted}: ${pubs.length} pubs`);
        } catch (err) {
          console.error(`TRF4 error for ${oab.oab_formatted}:`, err);
        }

        // TJRS via direct fetch (no Firecrawl - it keeps timing out)
        try {
          const pubs = await searchTJRS(oab, tenantId, caseMap);
          allPubs.push(...pubs);
          console.log(`TJRS for ${oab.oab_formatted}: ${pubs.length} pubs`);
        } catch (err) {
          console.error(`TJRS error for ${oab.oab_formatted}:`, err);
        }
      }

      // Deduplicate
      const seen = new Set<string>();
      const uniquePubs = allPubs.filter(p => {
        if (seen.has(p.unique_hash)) return false;
        seen.add(p.unique_hash);
        return true;
      });

      if (uniquePubs.length > 0) {
        let inserted = 0;
        for (const pub of uniquePubs) {
          const { error } = await serviceClient
            .from('dje_publications')
            .upsert(pub, { onConflict: 'unique_hash' });
          if (!error) inserted++;
          else console.error('Insert error:', error.message);
        }

        for (const uid of notifyUserIds) {
          await serviceClient.from('notifications').insert({
            user_id: uid,
            title: `${uniquePubs.length} publicação(ões) no DJE`,
            body: `Publicações vinculadas às OABs do escritório.`,
            case_id: null,
          });
        }

        console.log(`Tenant ${tenantId}: ${inserted} stored`);
        totalFound += uniquePubs.length;
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

// ==================== TRF4 via Firecrawl with corrected actions ====================
async function searchTRF4(
  apiKey: string, oabEntry: any, tenantId: string, caseMap: Record<string, string>
): Promise<any[]> {
  const oab = oabEntry.oab_formatted;

  // Use Firecrawl with MINIMAL corrected actions:
  // 1. Click "Judicial II" radio to show OAB fields
  // 2. Wait for JS to show the hidden #processo_oab span
  // 3. Type OAB into #oab1
  // 4. Click the search button (calls validaConsulta())
  // 5. Wait for results page to load
  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: 'https://www2.trf4.jus.br/trf4/diario/consulta_diario.php',
      formats: ['markdown'],
      timeout: 60000,
      actions: [
        // Step 1: Click Judicial II radio to show OAB fields
        { type: 'click', selector: 'input#tipo_publicacao_C' },
        // Step 2: Wait for JavaScript to show the OAB section
        { type: 'wait', milliseconds: 2000 },
        // Step 3: Type OAB number into the field
        { type: 'write', selector: 'input#oab1', text: oab },
        // Step 4: Click the search button
        { type: 'click', selector: 'input#botaoPesquisar' },
        // Step 5: Wait for results to load
        { type: 'wait', milliseconds: 8000 },
      ],
    }),
  });

  const data = await response.json();

  if (!data.success && !data.data) {
    console.error(`TRF4 Firecrawl error: ${JSON.stringify(data).substring(0, 500)}`);
    return [];
  }

  const markdown = data.data?.markdown || data.markdown || '';
  console.log(`TRF4 markdown: ${markdown.length} chars`);

  if (markdown.length < 200) {
    console.log(`TRF4 preview: ${markdown.substring(0, 500)}`);
    return [];
  }

  return parseDJEContent(markdown, 'TRF4', oabEntry, tenantId, caseMap,
    'https://www2.trf4.jus.br/trf4/diario/resultado_consulta.php');
}

// ==================== TJRS via direct fetch ====================
async function searchTJRS(
  oabEntry: any, tenantId: string, caseMap: Record<string, string>
): Promise<any[]> {
  const oabMatch = oabEntry.oab_formatted.match(/^([A-Z]{2})(\d+)$/);
  if (!oabMatch) return [];

  const oabNum = oabMatch[2].replace(/^0+/, '');
  const oabState = oabMatch[1];

  // Try multiple TJRS search endpoints
  const urls = [
    `https://www.tjrs.jus.br/novo/busca/?return=proc&oab_tipo=A&oab_uf=${oabState}&oab_num=${oabNum}`,
    `https://www1.tjrs.jus.br/busca/?tb=proc&oab=${oabState}${oabNum}`,
  ];

  for (const url of urls) {
    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
      });

      const html = await resp.text();
      console.log(`TJRS fetch ${url.substring(0, 60)}: ${resp.status}, ${html.length} chars`);

      if (html.length < 300) continue;

      // Strip HTML tags to get text
      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ');

      const pubs = parseDJEContent(text, 'TJRS', oabEntry, tenantId, caseMap, url);
      if (pubs.length > 0) return pubs;
    } catch (err) {
      console.error(`TJRS fetch error:`, err);
    }
  }

  return [];
}

// ==================== Parse DJE content ====================
function parseDJEContent(
  content: string, tribunal: string, oabEntry: any,
  tenantId: string, caseMap: Record<string, string>, sourceUrl: string
): any[] {
  const publications: any[] = [];
  const today = new Date().toISOString().split('T')[0];

  const procRegex = /(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/g;
  const processes: string[] = [];
  let match;
  while ((match = procRegex.exec(content)) !== null) {
    if (!processes.includes(match[1])) processes.push(match[1]);
  }

  if (processes.length === 0) {
    console.log(`${tribunal}: 0 process numbers in ${content.length} chars`);
    // Show some content for debugging
    const sample = content.substring(0, 400).replace(/\s+/g, ' ');
    console.log(`${tribunal} sample: ${sample}`);
    return [];
  }

  console.log(`${tribunal}: ${processes.length} process numbers found`);

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
    const procIdx = content.indexOf(proc);
    if (procIdx === -1) continue;

    const start = Math.max(0, procIdx - 300);
    const end = Math.min(content.length, procIdx + proc.length + 1500);
    const context = content.substring(start, end).trim();

    let pubType = 'Publicação DJE';
    for (const [regex, name] of typeKeywords) {
      if (regex.test(context)) { pubType = name; break; }
    }

    const dateRegex = /(\d{2})\/(\d{2})\/(\d{4})/g;
    let pubDate = today;
    let dMatch;
    while ((dMatch = dateRegex.exec(context)) !== null) {
      const year = parseInt(dMatch[3]);
      if (year >= 2024) { pubDate = `${dMatch[3]}-${dMatch[2]}-${dMatch[1]}`; break; }
    }

    const procClean = proc.replace(/[^0-9]/g, '');
    const caseId = caseMap[procClean] || null;
    const hash = `${tribunal.toLowerCase()}_dje_${procClean}_${pubDate}_${simpleHash(context.substring(0, 100))}`;

    publications.push({
      tenant_id: tenantId,
      oab_number: oabEntry.oab_formatted,
      source: tribunal,
      publication_date: pubDate,
      title: `${pubType} - ${proc}`.substring(0, 300),
      content: [
        `Processo: ${proc}`, `Tribunal: ${tribunal}`,
        `Advogado: ${oabEntry.full_name} (OAB ${oabEntry.oab_raw})`,
        `Data: ${pubDate}`, `Tipo: ${pubType}`, '', context.substring(0, 3000),
      ].join('\n').substring(0, 5000),
      publication_type: pubType,
      process_number: proc,
      organ: tribunal,
      unique_hash: hash,
      external_url: sourceUrl || null,
      case_id: caseId,
    });
  }

  return publications;
}

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
