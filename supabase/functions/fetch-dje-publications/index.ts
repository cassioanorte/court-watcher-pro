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
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');

    if (!firecrawlKey) {
      return new Response(JSON.stringify({ error: 'Firecrawl não configurado' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userId = claimsData.claims.sub;

    // Get user profile to find OAB and tenant
    // Get all profiles with OAB in the tenant
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', userId)
      .single();

    if (!userProfile?.tenant_id) {
      return new Response(JSON.stringify({ error: 'Perfil não encontrado.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const tenantId = userProfile.tenant_id;

    // Use service client to get all OAB numbers in the tenant
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

    console.log(`OABs encontradas no escritório: ${oabNumbers.join(', ')}`);

    // Get today and a week ago for broader search
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const formatDate = (d: Date) => {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    };

    const results: any[] = [];

    // === TRF4 DJE Search for each OAB ===
    for (const oab of oabNumbers) {
      console.log(`Buscando publicações TRF4 para OAB: ${oab}`);
      
      try {
        const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: `https://www.trf4.jus.br/trf4/diario/consulta_diario.php`,
            formats: ['markdown'],
            onlyMainContent: true,
            waitFor: 5000,
            actions: [
              { type: 'write', selector: 'input[name="txtOAB"]', text: oab },
              { type: 'write', selector: 'input[name="txtDataInicio"]', text: formatDate(weekAgo) },
              { type: 'write', selector: 'input[name="txtDataFim"]', text: formatDate(today) },
              { type: 'click', selector: 'input[type="submit"], button[type="submit"]' },
              { type: 'wait', milliseconds: 5000 },
            ],
          }),
        });

        const scrapeData = await scrapeResponse.json();
        
        if (scrapeData.success || scrapeData.data) {
          const markdown = scrapeData.data?.markdown || scrapeData.markdown || '';
          console.log(`TRF4 scrape result for ${oab}: ${markdown.length} chars`);
          
          if (markdown.length > 100) {
            const publications = parseTrf4Publications(markdown, oab, tenantId);
            results.push(...publications);
          }
        } else {
          console.error(`TRF4 scrape failed for ${oab}:`, JSON.stringify(scrapeData).substring(0, 500));
        }
      } catch (trf4Error) {
        console.error(`TRF4 scrape error for ${oab}:`, trf4Error);
      }
    }

    // === Store results in database (serviceClient already created above) ===
    if (results.length > 0) {

      for (const pub of results) {
        const { error: insertError } = await serviceClient
          .from('dje_publications')
          .upsert(pub, { onConflict: 'unique_hash' });
        
        if (insertError) {
          console.error('Insert error:', insertError.message);
        }
      }

      // Also create notifications for new publications
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

function parseTrf4Publications(markdown: string, oabNumber: string, tenantId: string): any[] {
  const publications: any[] = [];
  
  // Split by potential publication separators
  const sections = markdown.split(/---|\*\*\*|___/);
  
  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed || trimmed.length < 50) continue;
    
    // Look for process numbers (CNJ format)
    const processMatch = trimmed.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
    
    // Look for publication types
    const typePatterns = [
      { pattern: /despacho/i, type: 'Despacho' },
      { pattern: /decisão/i, type: 'Decisão' },
      { pattern: /sentença/i, type: 'Sentença' },
      { pattern: /intimação/i, type: 'Intimação' },
      { pattern: /acórdão/i, type: 'Acórdão' },
      { pattern: /ato\s+ordinatório/i, type: 'Ato Ordinatório' },
      { pattern: /certidão/i, type: 'Certidão' },
      { pattern: /edital/i, type: 'Edital' },
    ];
    
    let pubType = 'Publicação';
    for (const tp of typePatterns) {
      if (tp.pattern.test(trimmed)) {
        pubType = tp.type;
        break;
      }
    }

    // Extract title (first meaningful line)
    const lines = trimmed.split('\n').filter(l => l.trim().length > 0);
    const title = lines[0]?.replace(/[#*]/g, '').trim().substring(0, 300) || 'Publicação DJE';

    const hash = `trf4_${oabNumber}_${new Date().toISOString().split('T')[0]}_${simpleHash(trimmed.substring(0, 200))}`;

    publications.push({
      tenant_id: tenantId,
      oab_number: oabNumber,
      source: 'TRF4',
      publication_date: new Date().toISOString().split('T')[0],
      title,
      content: trimmed.substring(0, 5000),
      publication_type: pubType,
      process_number: processMatch?.[1] || null,
      organ: 'TRF4',
      unique_hash: hash,
    });
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

// Normalize OAB to TRF4 format: "RS073679"
// Input can be: "OAB/RS 73679", "OABRS73679", "RS 73679", "73679/RS", etc.
function normalizeOab(raw: string | null): string {
  if (!raw) return '';
  const clean = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  
  // Remove leading "OAB" if present
  const withoutOab = clean.replace(/^OAB/, '');
  
  // Try to extract state (2 letters) and number
  const match = withoutOab.match(/^([A-Z]{2})(\d+)$/);
  if (match) {
    const state = match[1];
    const num = match[2].padStart(6, '0');
    return `${state}${num}`;
  }
  
  // Try number first then state: "73679RS"
  const match2 = withoutOab.match(/^(\d+)([A-Z]{2})$/);
  if (match2) {
    const state = match2[2];
    const num = match2[1].padStart(6, '0');
    return `${state}${num}`;
  }
  
  return withoutOab;
}
