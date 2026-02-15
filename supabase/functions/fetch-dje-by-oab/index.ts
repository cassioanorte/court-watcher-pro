const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Busca publicações nos Diários de Justiça Eletrônicos por número de OAB.
 * Diferente da fetch-dje-publications (que usa DataJud por processo),
 * esta função busca TODAS as publicações vinculadas às OABs cadastradas.
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization');

    // Determine tenants to process
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
      console.log('🕐 CRON mode: processing all tenants');
      const { data: tenants } = await serviceClient
        .from('tenants').select('id').is('blocked_at', null);
      tenantIds = (tenants || []).map((t: any) => t.id);
    }

    let totalFound = 0;

    for (const tenantId of tenantIds) {
      // Get OAB numbers
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
          oab_formatted: formatOabForTribunal(p.oab_number),
        }));

      if (oabEntries.length === 0) {
        console.log(`Tenant ${tenantId}: no OAB numbers, skipping`);
        continue;
      }

      console.log(`Tenant ${tenantId}: searching DJE for ${oabEntries.length} OABs: ${oabEntries.map((o: any) => o.oab_formatted).join(', ')}`);

      // Get existing cases for linking
      const { data: cases } = await serviceClient
        .from('cases')
        .select('id, process_number')
        .eq('tenant_id', tenantId);

      const caseMap: Record<string, string> = {};
      for (const c of (cases || [])) {
        const clean = c.process_number.replace(/[^0-9]/g, '');
        caseMap[clean] = c.id;
      }

      // Get notify users (owners/staff)
      let notifyUserIds: string[] = [];
      if (userId && !isCron) {
        notifyUserIds = [userId];
      } else {
        const { data: tenantProfiles } = await serviceClient
          .from('profiles').select('user_id').eq('tenant_id', tenantId);
        for (const tp of (tenantProfiles || [])) {
          const { data: roles } = await serviceClient
            .from('user_roles').select('role').eq('user_id', tp.user_id).in('role', ['owner', 'staff']);
          if (roles && roles.length > 0) notifyUserIds.push(tp.user_id);
        }
      }

      const allPubs: any[] = [];

      // Search TRF4 DJE
      for (const oab of oabEntries) {
        try {
          const pubs = await searchTRF4DJE(oab.oab_formatted, oab, tenantId, caseMap);
          allPubs.push(...pubs);
          console.log(`TRF4 DJE for ${oab.oab_formatted}: ${pubs.length} publications`);
        } catch (err) {
          console.error(`TRF4 DJE error for ${oab.oab_formatted}:`, err);
        }
      }

      // Search TJRS DJE (Themis)
      for (const oab of oabEntries) {
        try {
          const pubs = await searchTJRSDJE(oab.oab_formatted, oab, tenantId, caseMap);
          allPubs.push(...pubs);
          console.log(`TJRS DJE for ${oab.oab_formatted}: ${pubs.length} publications`);
        } catch (err) {
          console.error(`TJRS DJE error for ${oab.oab_formatted}:`, err);
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

        // Notify users
        for (const uid of notifyUserIds) {
          // Only notify about new ones (simplified - notify about all found)
          if (allPubs.length > 0) {
            await serviceClient.from('notifications').insert({
              user_id: uid,
              title: `${allPubs.length} publicação(ões) no DJE`,
              body: `Encontradas ${allPubs.length} publicações vinculadas às OABs do escritório.`,
              case_id: null,
            });
          }
        }

        console.log(`Tenant ${tenantId}: ${inserted} publications stored`);
        totalFound += allPubs.length;
      }
    }

    console.log(`✅ Done. ${totalFound} DJE publications across ${tenantIds.length} tenants`);

    return new Response(JSON.stringify({
      success: true,
      found: totalFound,
      tenants_processed: tenantIds.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

// ==================== TRF4 DJE ====================
async function searchTRF4DJE(
  oabFormatted: string,
  oabEntry: any,
  tenantId: string,
  caseMap: Record<string, string>
): Promise<any[]> {
  // Get today and 7 days ago for date range
  const today = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const dateStart = formatDateBR(weekAgo);
  const dateEnd = formatDateBR(today);

  // First get session cookies
  const sessionResp = await fetch('https://www.trf4.jus.br/trf4/diario/consulta_diario.php', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });

  const cookies = sessionResp.headers.getSetCookie?.() || [];
  const cookieString = cookies.map((c: string) => c.split(';')[0]).join('; ');

  // Search Judicial II (tipo_publicacao=3) which contains OAB-linked publications
  const params = new URLSearchParams();
  params.append('tipo_publicacao', '3'); // Judicial II
  params.append('data_ini', dateStart);
  params.append('data_fim', dateEnd);
  params.append('orgao', '');
  params.append('localidade', '');
  params.append('unidade', '');
  params.append('serie_comp_jud', '');
  params.append('numero', '');
  params.append('processo', '');
  params.append('oab1', oabFormatted);
  params.append('oab2', '');
  params.append('oab3', '');
  params.append('oab4', '');
  params.append('oab5', '');
  params.append('oab6', '');
  params.append('oab7', '');
  params.append('docsPagina', '100');

  const response = await fetch('https://www.trf4.jus.br/trf4/diario/resultado_consulta.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Referer': 'https://www.trf4.jus.br/trf4/diario/consulta_diario.php',
      'Cookie': cookieString,
      'Origin': 'https://www.trf4.jus.br',
    },
    body: params.toString(),
  });

  const html = await response.text();
  console.log(`TRF4 DJE response: ${response.status}, ${html.length} chars`);

  // Parse publications from HTML
  return parseTRF4Results(html, oabEntry, tenantId, caseMap);
}

function parseTRF4Results(
  html: string,
  oabEntry: any,
  tenantId: string,
  caseMap: Record<string, string>
): any[] {
  const publications: any[] = [];

  // TRF4 results contain publication blocks - parse them
  // Look for document blocks with titles, dates, process numbers
  // The format varies but typically has:
  // - Document type (Despacho, Decisão, etc)
  // - Process number
  // - Content text

  // Extract individual document blocks
  // TRF4 uses <div class="resultado"> or similar patterns
  const docPattern = /<div[^>]*class="[^"]*resultado[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]*class="[^"]*resultado|$)/gi;
  
  // Alternative: look for publication entries by content patterns
  // Match process numbers (CNJ format)
  const processPattern = /(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/g;
  const datePattern = /(\d{2}\/\d{2}\/\d{4})/g;

  // Try to find structured results
  // Look for table rows or result blocks
  const blockPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;
  const blocks: string[] = [];
  
  while ((match = blockPattern.exec(html)) !== null) {
    const block = match[1];
    // Only include blocks that mention a process or have meaningful content
    if (processPattern.test(block) || block.length > 200) {
      blocks.push(block);
    }
    processPattern.lastIndex = 0;
  }

  // Also try finding <a> links to document downloads
  const linkPattern = /<a[^>]*href="([^"]*download[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const documentLinks: { url: string; title: string }[] = [];
  while ((match = linkPattern.exec(html)) !== null) {
    documentLinks.push({ url: match[1], title: stripHtml(match[2]).trim() });
  }

  // Parse the raw text for publication entries
  const textContent = stripHtml(html);
  
  // Find all process numbers in the content
  const processes: string[] = [];
  let procMatch;
  const procRegex = /(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/g;
  while ((procMatch = procRegex.exec(textContent)) !== null) {
    if (!processes.includes(procMatch[1])) {
      processes.push(procMatch[1]);
    }
  }

  // Find publication type keywords
  const typeKeywords = ['Despacho', 'Decisão', 'Sentença', 'Intimação', 'Ato Ordinatório', 
    'Acórdão', 'Citação', 'Edital', 'Certidão', 'Pauta'];

  // Extract sections between process numbers
  for (const proc of processes) {
    const procIndex = textContent.indexOf(proc);
    if (procIndex === -1) continue;

    // Get surrounding text (500 chars before and after)
    const start = Math.max(0, procIndex - 300);
    const end = Math.min(textContent.length, procIndex + proc.length + 1000);
    const context = textContent.substring(start, end).trim();

    // Determine publication type
    let pubType = 'Publicação DJE';
    for (const kw of typeKeywords) {
      if (context.toLowerCase().includes(kw.toLowerCase())) {
        pubType = kw;
        break;
      }
    }

    // Extract date
    const dates: string[] = [];
    const dRegex = /(\d{2})\/(\d{2})\/(\d{4})/g;
    let dMatch;
    while ((dMatch = dRegex.exec(context)) !== null) {
      dates.push(`${dMatch[3]}-${dMatch[2]}-${dMatch[1]}`);
    }
    const pubDate = dates[0] || new Date().toISOString().split('T')[0];

    // Find matching case
    const procClean = proc.replace(/[^0-9]/g, '');
    const caseId = caseMap[procClean] || null;

    const hash = `trf4_dje_${procClean}_${pubDate}_${simpleHash(context.substring(0, 100))}`;
    
    const content = [
      `Processo: ${proc}`,
      `Tribunal: TRF4`,
      `Advogado: ${oabEntry.full_name} (OAB ${oabEntry.oab_raw})`,
      `Data: ${pubDate}`,
      `Tipo: ${pubType}`,
      '',
      context.substring(0, 3000),
    ].join('\n');

    publications.push({
      tenant_id: tenantId,
      oab_number: oabEntry.oab_formatted,
      source: 'TRF4',
      publication_date: pubDate,
      title: `${pubType} - ${proc}`.substring(0, 300),
      content: content.substring(0, 5000),
      publication_type: pubType,
      process_number: proc,
      organ: 'TRF4',
      unique_hash: hash,
      external_url: null,
      case_id: caseId,
    });
  }

  console.log(`TRF4 parsed: ${processes.length} processes, ${publications.length} publications`);
  return publications;
}

// ==================== TJRS DJE ====================
async function searchTJRSDJE(
  oabFormatted: string,
  oabEntry: any,
  tenantId: string,
  caseMap: Record<string, string>
): Promise<any[]> {
  // TJRS Themis system - search via the web interface
  // URL: https://www.tjrs.jus.br/busca/?tb=proc
  // Uses OAB search parameter

  // Extract state and number from formatted OAB (e.g., RS070421)
  const oabMatch = oabFormatted.match(/^([A-Z]{2})(\d+)$/);
  if (!oabMatch) return [];

  const oabState = oabMatch[1];
  const oabNum = oabMatch[2];

  // Try the TJRS process search by OAB - this gives us process numbers
  // Then we can check if there are recent publications
  const url = `https://www.tjrs.jus.br/site_php/consulta/lista_processos_oab.php?entression=&oab_tipo=A&oab_uf=${oabState}&oab_num=${oabNum}&acao=pesquisa`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    const html = await response.text();
    console.log(`TJRS search response: ${response.status}, ${html.length} chars`);

    // Extract process numbers from the results
    const procRegex = /(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/g;
    const processes: string[] = [];
    let match;
    while ((match = procRegex.exec(html)) !== null) {
      if (!processes.includes(match[1])) processes.push(match[1]);
    }

    // Also try Themis format: NNNNNNN/NNNN
    const themisRegex = /(\d{3,9})\/(\d{4})/g;
    while ((match = themisRegex.exec(html)) !== null) {
      const themisProc = `${match[1]}/${match[2]}`;
      if (!processes.includes(themisProc)) processes.push(themisProc);
    }

    console.log(`TJRS found ${processes.length} processes for OAB ${oabFormatted}`);

    const publications: any[] = [];
    const today = new Date().toISOString().split('T')[0];

    // Parse surrounding text for each process to get details
    const textContent = stripHtml(html);

    for (const proc of processes.slice(0, 50)) { // limit to 50 processes
      const procClean = proc.replace(/[^0-9]/g, '');
      const caseId = caseMap[procClean] || null;
      
      // Get context around the process number
      const idx = textContent.indexOf(proc);
      if (idx === -1) continue;
      
      const start = Math.max(0, idx - 200);
      const end = Math.min(textContent.length, idx + proc.length + 500);
      const context = textContent.substring(start, end).trim();

      // Determine status/type from context
      let pubType = 'Movimentação';
      const contextLower = context.toLowerCase();
      if (/intima[çc][ãa]o|intimado/.test(contextLower)) pubType = 'Intimação';
      else if (/despacho/.test(contextLower)) pubType = 'Despacho';
      else if (/decis[ãa]o/.test(contextLower)) pubType = 'Decisão';
      else if (/senten[çc]a/.test(contextLower)) pubType = 'Sentença';

      const hash = `tjrs_dje_${procClean}_${today}_${simpleHash(context.substring(0, 80))}`;

      const content = [
        `Processo: ${proc}`,
        `Tribunal: TJRS`,
        `Advogado: ${oabEntry.full_name} (OAB ${oabEntry.oab_raw})`,
        `Data: ${today}`,
        '',
        context.substring(0, 3000),
      ].join('\n');

      publications.push({
        tenant_id: tenantId,
        oab_number: oabEntry.oab_formatted,
        source: 'TJRS',
        publication_date: today,
        title: `${pubType} - ${proc}`.substring(0, 300),
        content: content.substring(0, 5000),
        publication_type: pubType,
        process_number: proc,
        organ: 'TJRS',
        unique_hash: hash,
        external_url: null,
        case_id: caseId,
      });
    }

    return publications;
  } catch (err) {
    console.error('TJRS search error:', err);
    return [];
  }
}

// ==================== Utilities ====================
function formatOabForTribunal(raw: string): string {
  if (!raw) return '';
  const clean = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const withoutOab = clean.replace(/^OAB/, '');
  const match = withoutOab.match(/^([A-Z]{2})(\d+)$/);
  if (match) return `${match[1]}${match[2].padStart(6, '0')}`;
  const match2 = withoutOab.match(/^(\d+)([A-Z]{2})$/);
  if (match2) return `${match2[2]}${match2[1].padStart(6, '0')}`;
  return withoutOab;
}

function formatDateBR(date: Date): string {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
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
