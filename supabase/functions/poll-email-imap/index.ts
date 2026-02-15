const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ImapFlow } from "npm:imapflow@1.0.164";
import { simpleParser } from "npm:mailparser@3.7.2";

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
      return new Response(JSON.stringify({ success: true, message: 'Nenhuma credencial ativa', results: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results: any[] = [];

    for (const cred of credentials) {
      try {
        console.log(`Processing mailbox for tenant ${cred.tenant_id}: ${cred.imap_user}@${cred.imap_host}`);
        const result = await processMailbox(serviceClient, cred);
        results.push({ tenant_id: cred.tenant_id, ...result });

        await serviceClient
          .from('email_credentials')
          .update({ last_polled_at: new Date().toISOString() })
          .eq('id', cred.id);
      } catch (err) {
        console.error(`Error tenant ${cred.tenant_id}:`, err);
        results.push({ tenant_id: cred.tenant_id, error: err instanceof Error ? err.message : 'Erro', emails_scanned: 0, inserted: 0, found: 0 });
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
  const client = new ImapFlow({
    host: cred.imap_host,
    port: cred.imap_port,
    secure: cred.use_tls,
    auth: {
      user: cred.imap_user,
      pass: cred.imap_password,
    },
    logger: false,
  });

  let totalFound = 0;
  let totalInserted = 0;
  let emailsScanned = 0;

  try {
    await client.connect();
    console.log('IMAP connected successfully');

    const lock = await client.getMailboxLock('INBOX');

    try {
      const senders: string[] = cred.senders || [];
      
      // Search for recent emails from configured senders (last 7 days)
      const since = new Date();
      since.setDate(since.getDate() - 7);

      for (const sender of senders) {
        console.log(`Searching emails from: ${sender}`);
        
        const searchCriteria = {
          from: sender,
          since: since,
        };

        const messages = client.fetch(searchCriteria, {
          source: true,
          envelope: true,
          uid: true,
        });

        for await (const msg of messages) {
          emailsScanned++;
          
          try {
            const parsed = await simpleParser(msg.source);
            const subject = parsed.subject || '';
            const textBody = parsed.text || '';
            
            if (!textBody && !subject) continue;

            console.log(`Processing email: ${subject.substring(0, 80)}`);

            // Call parse function
            const apiKey = await generateApiKey(cred.tenant_id);
            const parseResponse = await fetch(
              `${Deno.env.get('SUPABASE_URL')}/functions/v1/parse-email-publications`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email_body: textBody.substring(0, 50000),
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
            } else {
              console.error('Parse error:', await parseResponse.text());
            }
          } catch (parseErr) {
            console.error('Error parsing message:', parseErr);
          }
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }

  console.log(`✅ Scanned ${emailsScanned} emails, found ${totalFound}, inserted ${totalInserted}`);
  return { found: totalFound, inserted: totalInserted, emails_scanned: emailsScanned };
}

async function generateApiKey(tenantId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`lovable-email-${tenantId}-integration`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}
