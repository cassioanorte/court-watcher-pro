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
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    const { email_body, email_subject, email_from, tenant_id, api_key } = body;

    if (!email_body || !tenant_id || !api_key) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios: email_body, tenant_id, api_key' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Validate API key matches tenant
    const { data: tenant, error: tenantErr } = await serviceClient
      .from('tenants')
      .select('id, name')
      .eq('id', tenant_id)
      .single();

    if (tenantErr || !tenant) {
      return new Response(JSON.stringify({ error: 'Tenant não encontrado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const expectedKey = await generateApiKey(tenant_id);
    if (api_key !== expectedKey) {
      return new Response(JSON.stringify({ error: 'API key inválida' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Detect source from email sender
    const source = detectSource(email_from || '', email_subject || '');
    console.log(`Processing email from: ${email_from}, source: ${source}`);

    // Parse content
    const fullContent = `${email_subject || ''}\n\n${email_body}`;
    const publications = parseEmailContent(fullContent, source, tenant_id);

    if (publications.length === 0) {
      console.log('No publications found in email');
      return new Response(JSON.stringify({ success: true, found: 0, message: 'Nenhuma publicação encontrada neste email' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get case map for linking
    const { data: cases } = await serviceClient
      .from('cases').select('id, process_number').eq('tenant_id', tenant_id);
    const caseMap: Record<string, string> = {};
    for (const c of (cases || [])) {
      caseMap[c.process_number.replace(/[^0-9]/g, '')] = c.id;
    }

    // Get OAB entries for enrichment
    const { data: profiles } = await serviceClient
      .from('profiles')
      .select('full_name, oab_number')
      .eq('tenant_id', tenant_id)
      .not('oab_number', 'is', null);

    // Enrich publications with case_id and OAB info
    let inserted = 0;
    for (const pub of publications) {
      if (pub.process_number) {
        const procClean = pub.process_number.replace(/[^0-9]/g, '');
        pub.case_id = caseMap[procClean] || null;
      }

      // OAB is now set per-section during parsing (pub.oab_number)
      // Only fallback if still empty: try matching OAB in the section content
      if (!pub.oab_number && profiles && profiles.length > 0) {
        const sectionContent = pub.content || '';
        for (const p of profiles) {
          if (p.oab_number) {
            const oabDigits = p.oab_number.replace(/[^0-9]/g, '');
            if (oabDigits && sectionContent.includes(oabDigits)) {
              pub.oab_number = p.oab_number;
              break;
            }
          }
        }
        // DO NOT fallback to first profile's OAB - this caused cross-contamination
      }

      const { error } = await serviceClient
        .from('dje_publications')
        .upsert(pub, { onConflict: 'unique_hash' });
      if (!error) inserted++;
      else console.error('Insert error:', error.message);
    }

    // Notify staff users
    const { data: staffProfiles } = await serviceClient
      .from('profiles').select('user_id').eq('tenant_id', tenant_id);
    if (staffProfiles) {
      for (const sp of staffProfiles) {
        const { data: roles } = await serviceClient
          .from('user_roles').select('role').eq('user_id', sp.user_id)
          .in('role', ['owner', 'staff']);
        if (roles && roles.length > 0) {
          await serviceClient.from('notifications').insert({
            user_id: sp.user_id,
            title: `${inserted} publicação(ões) via email`,
            body: `Publicações extraídas automaticamente de email do ${source}.`,
          });
        }
      }
    }

    console.log(`✅ Parsed ${inserted} publications from email`);
    return new Response(JSON.stringify({ success: true, found: publications.length, inserted }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

function detectSource(from: string, subject: string): string {
  const text = `${from} ${subject}`.toLowerCase();
  if (text.includes('trf4') || text.includes('trf 4') || text.includes('federal 4a regiao')) return 'TRF4';
  if (text.includes('tjrs') || text.includes('tj/rs') || text.includes('tribunal de justiça do rio grande') || text.includes('justica estadual rs') || text.includes('justica estadual/rs')) return 'TJRS';
  if (text.includes('trt4') || text.includes('trt 4') || text.includes('trabalho 4') || text.includes('trabalho rs')) return 'TRT4';
  if (text.includes('trf1') || text.includes('trf 1')) return 'TRF1';
  if (text.includes('trf2') || text.includes('trf 2')) return 'TRF2';
  if (text.includes('trf3') || text.includes('trf 3')) return 'TRF3';
  if (text.includes('trf5') || text.includes('trf 5')) return 'TRF5';
  if (text.includes('stj') || text.includes('superior tribunal de justica')) return 'STJ';
  if (text.includes('stf') || text.includes('supremo tribunal federal')) return 'STF';
  if (text.includes('tst') || text.includes('tribunal superior do trabalho')) return 'TST';
  if (text.includes('dje') || text.includes('diário') || text.includes('diario') || text.includes('djen')) return 'DJE';
  return 'EMAIL';
}

/**
 * Extract only the "teor" (substance) of a publication section,
 * removing tribunal headers, OAB info, and index listings.
 */
function extractTeor(sectionText: string): string {
  const lines = sectionText.split('\n');
  const cleanLines: string[] = [];
  let foundProcessNumber = false;
  let skipOabHeader = true;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (foundProcessNumber) cleanLines.push('');
      continue;
    }

    // Skip OAB header lines (e.g., "OAB/RS 070421 - NOME DO ADVOGADO")
    if (/^OAB\s*\/?\s*[A-Z]{2}\s+\d+/i.test(trimmed)) continue;

    // Skip "Neste e-mail X processos..." index lines
    if (/neste\s+e-?mail\s+\d+\s+processos?/i.test(trimmed)) continue;
    if (/processos?\s+est[ãa]o?\s+listados?/i.test(trimmed)) continue;
    if (/este\s+e-?mail\s+cont[ée]m/i.test(trimmed)) continue;

    // Skip lines that are just a process number listing (index)
    if (/^\s*-?\s*\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\s*$/.test(trimmed)) {
      if (!foundProcessNumber) continue; // Skip if in index area
    }

    // Detect when we hit the actual content (process number in context)
    if (/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/.test(trimmed)) {
      foundProcessNumber = true;
    }

    // Skip tribunal header lines at start before content
    if (skipOabHeader && !foundProcessNumber) {
      // Skip generic tribunal headers
      if (/^tribunal\s+(reg|regional|superior)/i.test(trimmed)) continue;
      if (/^(poder\s+judici[aá]rio|justi[cç]a\s+(do\s+trabalho|estadual|federal))/i.test(trimmed)) continue;
      if (/^disponibilizado\s+em\s*:/i.test(trimmed)) continue;
      if (/^\d+[ªaº]\s+(turma|vara|câmara|seção)/i.test(trimmed)) continue;
      if (/^sec\.gab\./i.test(trimmed)) continue;
      if (/^(apela[çc][ãa]o|agravo|recurso|mandado|a[çc][ãa]o|procedimento|embargos)/i.test(trimmed)) continue;
    }

    if (foundProcessNumber) {
      skipOabHeader = false;
    }

    cleanLines.push(trimmed);
  }

  // Remove leading empty lines
  let result = cleanLines.join('\n').replace(/^\n+/, '').trim();

  // If after cleaning we have very little content, return the original
  if (result.length < 50) {
    return sectionText.trim();
  }

  return result;
}

function parseEmailContent(content: string, source: string, tenantId: string): any[] {
  const publications: any[] = [];
  const today = new Date().toISOString().split('T')[0];

  // Try multiple separator patterns
  let sections: string[];
  
  // Pattern 1: Long dash lines (most common in OAB emails)
  sections = content.split(/\n\s*-{10,}\s*\n/);
  
  // Pattern 2: If only 1 section, try equal signs
  if (sections.length <= 1) {
    sections = content.split(/\n\s*={10,}\s*\n/);
  }
  
  // Pattern 3: If still 1 section, try asterisks
  if (sections.length <= 1) {
    sections = content.split(/\n\s*\*{10,}\s*\n/);
  }
  
  // Pattern 4: Try double blank lines as last resort separator
  if (sections.length <= 1) {
    // Split by double blank lines but only if content is long enough
    if (content.length > 2000) {
      sections = content.split(/\n\s*\n\s*\n/);
    }
  }

  // Find all CNJ process numbers
  const procRegex = /(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/g;

  // Type detection keywords
  const typeKeywords: [RegExp, string][] = [
    [/intima[çc][ãa]o|intimado/i, 'Intimação'],
    [/despacho/i, 'Despacho'],
    [/decis[ãa]o/i, 'Decisão'],
    [/senten[çc]a/i, 'Sentença'],
    [/ac[óo]rd[ãa]o/i, 'Acórdão'],
    [/ato\s*ordinat[óo]rio/i, 'Ato Ordinatório'],
    [/cita[çc][ãa]o/i, 'Citação'],
    [/edital/i, 'Edital'],
    [/nota\s*de\s*expediente/i, 'Nota de Expediente'],
    [/pauta\s*de\s*julgamento/i, 'Pauta de Julgamento'],
    [/distribui[çc][ãa]o|distribuido/i, 'Distribuição'],
  ];

  const seenProcs = new Set<string>();

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    // Skip OAB index sections
    if (isOabIndexSection(trimmed)) continue;

    // Find process numbers in this section
    const procsInSection: string[] = [];
    let match;
    const sectionProcRegex = /(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/g;
    while ((match = sectionProcRegex.exec(trimmed)) !== null) {
      if (!procsInSection.includes(match[1])) procsInSection.push(match[1]);
    }

    if (procsInSection.length === 0) continue;

    // Detect publication type from the full section
    let pubType = 'Publicação DJE';
    for (const [regex, name] of typeKeywords) {
      if (regex.test(trimmed)) { pubType = name; break; }
    }

    // Try to extract date from section
    const dateRegex = /(\d{2})\/(\d{2})\/(\d{4})/g;
    let pubDate = today;
    let dMatch;
    while ((dMatch = dateRegex.exec(trimmed)) !== null) {
      const year = parseInt(dMatch[3]);
      if (year >= 2024) { pubDate = `${dMatch[3]}-${dMatch[2]}-${dMatch[1]}`; break; }
    }

    // Extract clean teor (substance) from the section
    const cleanContent = extractTeor(trimmed);

    // Extract OAB numbers found in THIS specific section only
    const sectionOabs = extractOabsFromSection(trimmed);

    for (const proc of procsInSection) {
      const procClean = proc.replace(/[^0-9]/g, '');
      const hashKey = `${procClean}_${pubDate}_${pubType}`;
      if (seenProcs.has(hashKey)) continue;
      seenProcs.add(hashKey);

      // Use section-specific OAB if found, otherwise leave empty for enrichment
      const sectionOab = sectionOabs.length > 0 ? sectionOabs.join(', ') : '';

      const hash = `email_${source.toLowerCase()}_${procClean}_${pubDate}_${pubType.toLowerCase().replace(/\s+/g, '_')}`;

      publications.push({
        tenant_id: tenantId,
        oab_number: sectionOab,
        source,
        publication_date: pubDate,
        title: `${pubType} - ${proc}`.substring(0, 300),
        content: cleanContent.substring(0, 10000),
        publication_type: pubType,
        process_number: proc,
        organ: source,
        unique_hash: hash,
        external_url: null,
        case_id: null,
      });
    }
  }

  // Fallback: if no publications found, try full content approach
  if (publications.length === 0) {
    let match;
    const fallbackProcs: string[] = [];
    while ((match = procRegex.exec(content)) !== null) {
      if (!fallbackProcs.includes(match[1])) fallbackProcs.push(match[1]);
    }
    
    const cleanContent = extractTeor(content);
    
    for (const proc of fallbackProcs) {
      const procClean = proc.replace(/[^0-9]/g, '');
      let pubType = 'Publicação DJE';
      for (const [regex, name] of typeKeywords) {
        if (regex.test(content)) { pubType = name; break; }
      }
      const hash = `email_${source.toLowerCase()}_${procClean}_${today}_${pubType.toLowerCase().replace(/\s+/g, '_')}`;
      publications.push({
        tenant_id: tenantId,
        oab_number: '',
        source,
        publication_date: today,
        title: `${pubType} - ${proc}`.substring(0, 300),
        content: cleanContent.substring(0, 10000),
        publication_type: pubType,
        process_number: proc,
        organ: source,
        unique_hash: hash,
        external_url: null,
        case_id: null,
      });
    }
  }

  return publications;
}

/**
 * Extract OAB numbers from a specific section of text.
 * Returns only unique OAB digit strings found in the section.
 */
function extractOabsFromSection(sectionText: string): string[] {
  const oabRegex = /OAB\s*\/?\s*([A-Z]{2})\s*[.\s]*(\d[\d.]+)/gi;
  const found: string[] = [];
  let match;
  while ((match = oabRegex.exec(sectionText)) !== null) {
    const digits = match[2].replace(/[^0-9]/g, '');
    if (digits && !found.includes(digits)) {
      found.push(digits);
    }
  }
  return found;
}

/**
 * Detect if a section is an OAB index/header section
 * (lists lawyers and process numbers but no actual content)
 */
function isOabIndexSection(text: string): boolean {
  if (/NESTE\s+E-?MAIL\s+\d+\s+PROCESSOS?\b/i.test(text) && text.length < 1000) return true;
  if (/PROCESSOS?\s+EST[ÃA]O?\s+LISTADOS?/i.test(text) && text.length < 1000) return true;
  if (/ESTE\s+E-?MAIL\s+CONT[ÉE]M\s+AS\s+INTIMA[ÇC][ÕO]ES/i.test(text) && text.length < 1000) return true;
  
  const oabMatches = text.match(/OAB\s*\/?\s*[A-Z]{2}\s*\d+/gi);
  const procMatches = text.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g);
  
  if (oabMatches && oabMatches.length >= 2 && text.length < 1500) return true;
  
  if (procMatches && procMatches.length > 3) {
    const textWithoutProcs = text.replace(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g, '').trim();
    const avgCharsPerProc = textWithoutProcs.length / procMatches.length;
    if (avgCharsPerProc < 100) return true;
  }

  return false;
}

async function generateApiKey(tenantId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`lovable-email-${tenantId}-integration`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}
