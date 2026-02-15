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

    // Simple API key validation - hash of tenant_id + slug
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

      // Try to match OAB from content
      if (!pub.oab_number && profiles && profiles.length > 0) {
        for (const p of profiles) {
          if (p.oab_number && fullContent.includes(p.oab_number.replace(/[^0-9]/g, ''))) {
            pub.oab_number = p.oab_number;
            break;
          }
        }
        // Default to first profile's OAB
        if (!pub.oab_number && profiles[0]?.oab_number) {
          pub.oab_number = profiles[0].oab_number;
        }
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
  if (text.includes('trf4') || text.includes('trf 4')) return 'TRF4';
  if (text.includes('tjrs') || text.includes('tj/rs') || text.includes('tribunal de justiça do rio grande')) return 'TJRS';
  if (text.includes('trf1') || text.includes('trf 1')) return 'TRF1';
  if (text.includes('trf2') || text.includes('trf 2')) return 'TRF2';
  if (text.includes('trf3') || text.includes('trf 3')) return 'TRF3';
  if (text.includes('trf5') || text.includes('trf 5')) return 'TRF5';
  if (text.includes('stj')) return 'STJ';
  if (text.includes('stf')) return 'STF';
  if (text.includes('tst')) return 'TST';
  if (text.includes('dje') || text.includes('diário') || text.includes('diario')) return 'DJE';
  return 'EMAIL';
}

function parseEmailContent(content: string, source: string, tenantId: string): any[] {
  const publications: any[] = [];
  const today = new Date().toISOString().split('T')[0];

  // Find all CNJ process numbers
  const procRegex = /(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/g;
  const processes: string[] = [];
  let match;
  while ((match = procRegex.exec(content)) !== null) {
    if (!processes.includes(match[1])) processes.push(match[1]);
  }

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
  ];

  if (processes.length === 0) {
    // No process numbers found - create a single generic publication from the email
    let pubType = 'Publicação DJE';
    for (const [regex, name] of typeKeywords) {
      if (regex.test(content)) { pubType = name; break; }
    }

    const hash = `email_${source.toLowerCase()}_${today}_${simpleHash(content.substring(0, 200))}`;
    publications.push({
      tenant_id: tenantId,
      oab_number: '',
      source,
      publication_date: today,
      title: `${pubType} - ${source} (via email)`.substring(0, 300),
      content: content.substring(0, 5000),
      publication_type: pubType,
      process_number: null,
      organ: source,
      unique_hash: hash,
      external_url: null,
      case_id: null,
    });
    return publications;
  }

  for (const proc of processes) {
    const procIdx = content.indexOf(proc);
    if (procIdx === -1) continue;

    const start = Math.max(0, procIdx - 300);
    const end = Math.min(content.length, procIdx + proc.length + 2000);
    const context = content.substring(start, end).trim();

    let pubType = 'Publicação DJE';
    for (const [regex, name] of typeKeywords) {
      if (regex.test(context)) { pubType = name; break; }
    }

    // Try to extract date
    const dateRegex = /(\d{2})\/(\d{2})\/(\d{4})/g;
    let pubDate = today;
    let dMatch;
    while ((dMatch = dateRegex.exec(context)) !== null) {
      const year = parseInt(dMatch[3]);
      if (year >= 2024) { pubDate = `${dMatch[3]}-${dMatch[2]}-${dMatch[1]}`; break; }
    }

    const procClean = proc.replace(/[^0-9]/g, '');
    const hash = `email_${source.toLowerCase()}_${procClean}_${pubDate}_${simpleHash(context.substring(0, 100))}`;

    publications.push({
      tenant_id: tenantId,
      oab_number: '',
      source,
      publication_date: pubDate,
      title: `${pubType} - ${proc}`.substring(0, 300),
      content: context.substring(0, 5000),
      publication_type: pubType,
      process_number: proc,
      organ: source,
      unique_hash: hash,
      external_url: null,
      case_id: null,
    });
  }

  return publications;
}

async function generateApiKey(tenantId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`lovable-email-${tenantId}-integration`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
