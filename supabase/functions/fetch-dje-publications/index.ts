const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// DataJud API endpoint mapping for each tribunal
const DATAJUD_ENDPOINTS: Record<string, string> = {
  'TJRS_1G': 'api_publica_tjrs',
  'TJRS_2G': 'api_publica_tjrs',
  'TRF4_JFRS': 'api_publica_trf4',
  'TRF4_JFSC': 'api_publica_trf4',
  'TRF4_JFPR': 'api_publica_trf4',
  'TRF4': 'api_publica_trf4',
  'TST': 'api_publica_tst',
  'TSE': 'api_publica_tse',
  'STJ': 'api_publica_stj',
  'STM': 'api_publica_stm',
  'TRF1': 'api_publica_trf1',
  'TRF2': 'api_publica_trf2',
  'TRF3': 'api_publica_trf3',
  'TRF5': 'api_publica_trf5',
  'TRF6': 'api_publica_trf6',
  'TRT1': 'api_publica_trt1',
  'TRT2': 'api_publica_trt2',
  'TRT3': 'api_publica_trt3',
  'TRT4': 'api_publica_trt4',
  'TRT5': 'api_publica_trt5',
  'TRT6': 'api_publica_trt6',
  'TRT7': 'api_publica_trt7',
  'TRT8': 'api_publica_trt8',
  'TRT9': 'api_publica_trt9',
  'TRT10': 'api_publica_trt10',
  'TRT11': 'api_publica_trt11',
  'TRT12': 'api_publica_trt12',
  'TRT13': 'api_publica_trt13',
  'TRT14': 'api_publica_trt14',
  'TRT15': 'api_publica_trt15',
  'TRT16': 'api_publica_trt16',
  'TRT17': 'api_publica_trt17',
  'TRT18': 'api_publica_trt18',
  'TRT19': 'api_publica_trt19',
  'TRT20': 'api_publica_trt20',
  'TRT21': 'api_publica_trt21',
  'TRT22': 'api_publica_trt22',
  'TRT23': 'api_publica_trt23',
  'TRT24': 'api_publica_trt24',
};

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
    const datajudApiKey = Deno.env.get('DATAJUD_API_KEY');

    if (!datajudApiKey) {
      return new Response(JSON.stringify({ error: 'Chave da API DataJud não configurada.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

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

    // Get tenant
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', userId)
      .single();

    if (!userProfile?.tenant_id) {
      return new Response(JSON.stringify({ error: 'Perfil não encontrado.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const tenantId = userProfile.tenant_id;

    // Get OAB numbers for matching
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

    console.log(`OABs: ${oabNumbers.join(', ')}`);

    // Get all cases for this tenant to query DataJud by process number
    const { data: cases } = await serviceClient
      .from('cases')
      .select('id, process_number, source, client_user_id')
      .eq('tenant_id', tenantId);

    if (!cases || cases.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum processo cadastrado.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`Encontrados ${cases.length} processos para consultar`);

    // Group cases by tribunal endpoint
    const casesByEndpoint: Record<string, typeof cases> = {};
    for (const c of cases) {
      const endpoint = DATAJUD_ENDPOINTS[c.source] || null;
      if (!endpoint) {
        console.log(`No DataJud endpoint for source: ${c.source}`);
        continue;
      }
      if (!casesByEndpoint[endpoint]) casesByEndpoint[endpoint] = [];
      casesByEndpoint[endpoint].push(c);
    }

    const allPublications: any[] = [];

    // Query DataJud for each tribunal
    for (const [endpoint, endpointCases] of Object.entries(casesByEndpoint)) {
      // Process in batches of 10 to avoid huge queries
      for (let i = 0; i < endpointCases.length; i += 10) {
        const batch = endpointCases.slice(i, i + 10);
        const processNumbers = batch.map(c => c.process_number.replace(/[^0-9]/g, ''));

        console.log(`Querying DataJud ${endpoint} for ${processNumbers.length} processes`);

        try {
          const publications = await queryDataJud(datajudApiKey, endpoint, processNumbers, batch, tenantId, oabNumbers);
          allPublications.push(...publications);
        } catch (err) {
          console.error(`DataJud error for ${endpoint}:`, err);
        }
      }
    }

    console.log(`Total publications found: ${allPublications.length}`);

    // Store results
    if (allPublications.length > 0) {
      let inserted = 0;
      for (const pub of allPublications) {
        const { error: insertError } = await serviceClient
          .from('dje_publications')
          .upsert(pub, { onConflict: 'unique_hash' });
        if (insertError) {
          console.error('Insert error:', insertError.message);
        } else {
          inserted++;
        }
      }

      // Create notifications for new publications
      for (const pub of allPublications) {
        await serviceClient.from('notifications').insert({
          user_id: userId,
          title: `Nova publicação - ${pub.publication_type || pub.source}`,
          body: pub.title.substring(0, 200),
          case_id: pub.case_id || null,
        }).then(() => {});
      }

      console.log(`Inserted/updated ${inserted} publications`);
    }

    return new Response(JSON.stringify({
      success: true,
      found: allPublications.length,
      publications: allPublications.map(r => ({
        title: r.title,
        source: r.source,
        date: r.publication_date,
        type: r.publication_type,
        process: r.process_number,
      }))
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

async function queryDataJud(
  apiKey: string,
  endpoint: string,
  processNumbers: string[],
  cases: any[],
  tenantId: string,
  oabNumbers: string[]
): Promise<any[]> {
  const url = `https://api-publica.datajud.cnj.jus.br/${endpoint}/_search`;

  // Build Elasticsearch query to search for multiple process numbers
  const query = {
    size: 100,
    query: {
      bool: {
        should: processNumbers.map(num => ({
          match: { numeroProcesso: num }
        })),
        minimum_should_match: 1,
      }
    },
    sort: [{ "dataAjuizamento": { order: "desc" } }],
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `APIKey ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(query),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`DataJud API error (${response.status}): ${errorText.substring(0, 500)}`);
    throw new Error(`DataJud API error: ${response.status}`);
  }

  const data = await response.json();
  const hits = data.hits?.hits || [];
  console.log(`DataJud returned ${hits.length} results for ${endpoint}`);

  // Log the structure of the first hit to understand the data format
  if (hits.length > 0) {
    const firstSource = hits[0]._source;
    const topKeys = Object.keys(firstSource || {});
    console.log(`DataJud _source keys: ${topKeys.join(', ')}`);
    
    // Check for movements in various possible field names
    const movKeys = topKeys.filter(k => /mov|compl|ato|andamento|publicacao|intimacao/i.test(k));
    console.log(`Movement-like keys: ${movKeys.join(', ') || '(none)'}`);
    
    // Log dadosBasicos if present
    if (firstSource?.dadosBasicos) {
      console.log(`dadosBasicos keys: ${Object.keys(firstSource.dadosBasicos).join(', ')}`);
    }
    
    // Check movimento array
    for (const key of ['movimentos', 'movimento', 'listaMovimentos', 'movimentacao']) {
      if (firstSource?.[key]) {
        const arr = Array.isArray(firstSource[key]) ? firstSource[key] : [firstSource[key]];
        console.log(`Found ${key}: ${arr.length} items, first: ${JSON.stringify(arr[0]).substring(0, 300)}`);
      }
    }
    
    // Log a snippet of the full source to find movements
    const sourceStr = JSON.stringify(firstSource);
    console.log(`Full source snippet (first 1500): ${sourceStr.substring(0, 1500)}`);
  }

  const publications: any[] = [];

  for (const hit of hits) {
    const source = hit._source;
    if (!source) continue;

    const processNumber = source.numeroProcesso || '';
    const tribunal = source.tribunal || endpoint.replace('api_publica_', '').toUpperCase();

    // Find matching case
    const matchingCase = cases.find(c =>
      c.process_number.replace(/[^0-9]/g, '') === processNumber.replace(/[^0-9]/g, '')
    );

    // Extract movements - try all possible field names
    let movements = source.movimentos || source.movimento || source.listaMovimentos || source.movimentacao || [];
    if (!Array.isArray(movements)) {
      movements = [movements];
    }
    
    // Also check nested dadosBasicos
    if (movements.length === 0 && source.dadosBasicos?.movimentos) {
      movements = source.dadosBasicos.movimentos;
    }
    
    console.log(`Process ${processNumber}: ${movements.length} movements found`);

    // Get last 365 days of movements (DataJud has indexing delay)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 365);

    for (const mov of movements) {
      const movDate = mov.dataHora ? new Date(mov.dataHora) : null;
      if (!movDate || movDate < cutoffDate) continue;

      const movName = mov.nome || mov.complementosTabelados?.map((c: any) => c.nome || c.descricao).join(' - ') || 'Movimentação';
      const pubDate = movDate.toISOString().split('T')[0];

      // Format process number for display
      const formattedProcess = formatProcessNumber(processNumber);

      const title = `${movName} - Processo ${formattedProcess}`;
      const content = [
        `Processo: ${formattedProcess}`,
        `Tribunal: ${tribunal}`,
        `Data: ${pubDate}`,
        `Movimento: ${movName}`,
        mov.complementosTabelados?.map((c: any) => `${c.nome || ''}: ${c.descricao || c.valor || ''}`).join('\n') || '',
      ].filter(Boolean).join('\n');

      const hash = `datajud_${processNumber}_${pubDate}_${simpleHash(movName)}`;

      // Determine publication type from movement name
      let pubType = 'Movimentação';
      const movNameLower = movName.toLowerCase();
      if (/despacho/.test(movNameLower)) pubType = 'Despacho';
      else if (/decis[ãa]o/.test(movNameLower)) pubType = 'Decisão';
      else if (/senten[çc]a/.test(movNameLower)) pubType = 'Sentença';
      else if (/intima[çc][ãa]o/.test(movNameLower)) pubType = 'Intimação';
      else if (/ac[óo]rd[ãa]o/.test(movNameLower)) pubType = 'Acórdão';
      else if (/ato\s*ordinat[óo]rio/.test(movNameLower)) pubType = 'Ato Ordinatório';
      else if (/cita[çc][ãa]o/.test(movNameLower)) pubType = 'Citação';
      else if (/distribui[çc][ãa]o/.test(movNameLower)) pubType = 'Distribuição';
      else if (/julgamento/.test(movNameLower)) pubType = 'Julgamento';
      else if (/peti[çc][ãa]o/.test(movNameLower)) pubType = 'Petição';
      else if (/recurso/.test(movNameLower)) pubType = 'Recurso';

      // Match OAB if possible
      let matchedOab = oabNumbers[0];
      const contentStr = JSON.stringify(source);
      for (const oab of oabNumbers) {
        if (contentStr.includes(oab) || contentStr.includes(oab.replace(/^([A-Z]{2})0*/, '$1'))) {
          matchedOab = oab;
          break;
        }
      }

      publications.push({
        tenant_id: tenantId,
        oab_number: matchedOab,
        source: tribunal,
        publication_date: pubDate,
        title: title.substring(0, 300),
        content: content.substring(0, 5000),
        publication_type: pubType,
        process_number: formattedProcess,
        organ: tribunal,
        unique_hash: hash,
        external_url: null,
        case_id: matchingCase?.id || null,
      });
    }
  }

  return publications;
}

function formatProcessNumber(num: string): string {
  const clean = num.replace(/[^0-9]/g, '');
  if (clean.length === 20) {
    return `${clean.slice(0, 7)}-${clean.slice(7, 9)}.${clean.slice(9, 13)}.${clean.slice(13, 14)}.${clean.slice(14, 16)}.${clean.slice(16, 20)}`;
  }
  return num;
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
