const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ImapClient } from "jsr:@workingdevshero/deno-imap";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let targetTenantId: string | null = null;
    try {
      const body = await req.json();
      targetTenantId = body.tenant_id || null;
    } catch { /* no body */ }

    let query = serviceClient
      .from('email_credentials')
      .select('*')
      .eq('is_active', true);

    if (targetTenantId) {
      query = query.eq('tenant_id', targetTenantId);
    }

    const { data: credentials, error: credErr } = await query;
    if (credErr) throw new Error(`DB error: ${credErr.message}`);
    if (!credentials || credentials.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'Nenhuma credencial ativa' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results: any[] = [];

    for (const cred of credentials) {
      try {
        const result = await processMailbox(serviceClient, cred);
        results.push({ tenant_id: cred.tenant_id, ...result });

        await serviceClient
          .from('email_credentials')
          .update({ last_polled_at: new Date().toISOString() })
          .eq('id', cred.id);
      } catch (err) {
        console.error(`Error tenant ${cred.tenant_id}:`, err);
        results.push({ tenant_id: cred.tenant_id, error: err instanceof Error ? err.message : 'Erro' });
      }
    }

    return new Response(JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

async function processMailbox(serviceClient: any, cred: any) {
  const client = new ImapClient({
    host: cred.imap_host,
    port: cred.imap_port,
    tls: cred.use_tls,
    username: cred.imap_user,
    password: cred.imap_password,
  });

  try {
    // ImapClient connect() handles login internally
    await client.connect();

    // Select INBOX
    const inbox = await client.select("INBOX");
    console.log(`Mailbox INBOX selected, ${inbox?.exists || 0} messages`);

    const senders: string[] = cred.senders || [];
    let totalFound = 0;
    let totalInserted = 0;
    let emailsScanned = 0;

    // Search for recent emails from court senders
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const sinceStr = formatImapDate(threeDaysAgo);

    for (const sender of senders) {
      try {
        // Search for messages from this sender since 3 days ago
        const searchResult = await client.search(`FROM "${sender}" SINCE ${sinceStr}`);
        if (!searchResult || searchResult.length === 0) continue;

        // Fetch the found messages (limit to 20 per sender)
        const uids = searchResult.slice(-20);
        const fetchRange = uids.join(',');
        
        const messages = await client.fetch(fetchRange, {
          body: true,
          envelope: true,
        });

        if (!messages) continue;
        const msgList = Array.isArray(messages) ? messages : [messages];

        for (const msg of msgList) {
          emailsScanned++;
          
          const subject = msg.envelope?.subject || '';
          const body = typeof msg.body === 'string' ? msg.body : '';
          const plainBody = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

          if (!plainBody && !subject) continue;

          const apiKey = await generateApiKey(cred.tenant_id);
          const parseResponse = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/parse-email-publications`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email_body: plainBody.substring(0, 50000),
                email_subject: subject,
                email_from: sender,
                tenant_id: cred.tenant_id,
                api_key: apiKey,
              }),
            }
          );

          if (parseResponse.ok) {
            const result = await parseResponse.json();
            totalFound += result.found || 0;
            totalInserted += result.inserted || 0;
          }
        }
      } catch (e) {
        console.log(`Search error for ${sender}:`, e);
      }
    }

    return { found: totalFound, inserted: totalInserted, emails_scanned: emailsScanned };
  } finally {
    try { await client.disconnect(); } catch { /* ignore */ }
  }
}

function formatImapDate(date: Date): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${date.getDate()}-${months[date.getMonth()]}-${date.getFullYear()}`;
}

async function generateApiKey(tenantId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`lovable-email-${tenantId}-integration`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}
