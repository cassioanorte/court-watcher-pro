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
    let isCron = false;
    let requestedLookbackDays: number | null = null;
    try {
      const body = await req.json();
      targetTenantId = body.tenant_id || null;
      isCron = body.mode === 'cron';
      if (body.lookback_days && typeof body.lookback_days === 'number') {
        requestedLookbackDays = Math.min(Math.max(body.lookback_days, 1), 60);
      }
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
    const startTime = Date.now();
    const MAX_RUNTIME_MS = 140_000; // 140s safety margin (limit is 150s)

    for (const cred of credentials) {
      // Check if we're running out of time
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        console.log('⏱️ Approaching time limit, stopping early');
        break;
      }

      try {
        console.log(`Processing mailbox for tenant ${cred.tenant_id}: ${cred.imap_user}@${cred.imap_host}`);
        const lookbackDays = requestedLookbackDays || 1;
        const result = await processMailbox(serviceClient, cred, lookbackDays, startTime, MAX_RUNTIME_MS);
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

// Folders to check besides INBOX
const FOLDERS_TO_CHECK = ['INBOX', '[Gmail]/Spam', 'Junk', 'Spam', 'INBOX.Spam', 'INBOX.Junk'];

/**
 * Convert HTML to clean text preserving proper spacing.
 * mailparser's built-in text conversion often joins words together.
 */
function htmlToCleanText(html: string): string {
  let text = html;
  // Replace block-level tags with newlines
  text = text.replace(/<\/(p|div|br|tr|li|h[1-6]|blockquote|pre|section|article)>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/(td|th)>/gi, ' ');
  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Decode common HTML entities
  text = text.replace(/&nbsp;/gi, ' ');
  text = text.replace(/&amp;/gi, '&');
  text = text.replace(/&lt;/gi, '<');
  text = text.replace(/&gt;/gi, '>');
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/&#39;/gi, "'");
  text = text.replace(/&aacute;/gi, 'á');
  text = text.replace(/&eacute;/gi, 'é');
  text = text.replace(/&iacute;/gi, 'í');
  text = text.replace(/&oacute;/gi, 'ó');
  text = text.replace(/&uacute;/gi, 'ú');
  text = text.replace(/&atilde;/gi, 'ã');
  text = text.replace(/&otilde;/gi, 'õ');
  text = text.replace(/&ccedil;/gi, 'ç');
  text = text.replace(/&Aacute;/gi, 'Á');
  text = text.replace(/&Eacute;/gi, 'É');
  text = text.replace(/&Iacute;/gi, 'Í');
  text = text.replace(/&Oacute;/gi, 'Ó');
  text = text.replace(/&Uacute;/gi, 'Ú');
  text = text.replace(/&Atilde;/gi, 'Ã');
  text = text.replace(/&Otilde;/gi, 'Õ');
  text = text.replace(/&Ccedil;/gi, 'Ç');
  text = text.replace(/&#\d+;/g, ' ');
  // Collapse multiple spaces (but not newlines)
  text = text.replace(/[^\S\n]+/g, ' ');
  // Collapse multiple newlines
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

async function processMailbox(serviceClient: any, cred: any, lookbackDays: number, startTime: number, maxRuntimeMs: number) {
  const client = new ImapFlow({
    host: cred.imap_host,
    port: cred.imap_port,
    secure: cred.use_tls,
    auth: {
      user: cred.imap_user,
      pass: cred.imap_password,
    },
    logger: false,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });

  let totalFound = 0;
  let totalInserted = 0;
  let emailsScanned = 0;
  let errors = 0;
  let timedOut = false;

  try {
    await client.connect();
    console.log(`IMAP connected (lookback: ${lookbackDays} days)`);

    const senders: string[] = cred.senders || [];
    
    // Search for emails from lookback period
    const since = new Date();
    since.setDate(since.getDate() - lookbackDays);

    // Try each folder
    for (const folder of FOLDERS_TO_CHECK) {
      let lock;
      try {
        lock = await client.getMailboxLock(folder);
        console.log(`📂 Checking folder: ${folder}`);
      } catch {
        continue;
      }

      try {
        for (const sender of senders) {
          console.log(`Searching emails from: ${sender} in ${folder} (since ${since.toISOString().split('T')[0]})`);
          
          const searchCriteria = {
            from: sender,
            since: since,
          };

          try {
            const messages = client.fetch(searchCriteria, {
              source: true,
              envelope: true,
              uid: true,
            });

            for await (const msg of messages) {
              // Time guard
              if (Date.now() - startTime > maxRuntimeMs) {
                console.log('⏱️ Time limit reached during email processing');
                timedOut = true;
                break;
              }
              emailsScanned++;
              
              try {
                const parsed = await simpleParser(msg.source);
                const subject = parsed.subject || '';
                
                // Prefer HTML with proper conversion, fallback to text
                let textBody = '';
                if (parsed.html) {
                  textBody = htmlToCleanText(parsed.html);
                } else if (parsed.text) {
                  textBody = parsed.text;
                }
                
                if (!textBody && !subject) continue;

                console.log(`Processing email ${emailsScanned}: ${subject.substring(0, 80)}`);

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
                  const errText = await parseResponse.text();
                  console.error(`Parse error for "${subject.substring(0, 40)}": ${errText.substring(0, 200)}`);
                  errors++;
                }
              } catch (parseErr) {
                console.error(`Error parsing message ${emailsScanned}:`, parseErr instanceof Error ? parseErr.message : parseErr);
                errors++;
              }
            }
          } catch (fetchErr) {
            console.error(`Error fetching from sender ${sender} in ${folder}:`, fetchErr instanceof Error ? fetchErr.message : fetchErr);
            errors++;
          }
          if (timedOut) break;
        }
      } finally {
        lock.release();
      }
      if (timedOut) break;
    }
  } finally {
    await client.logout().catch(() => {});
  }

  console.log(`✅ Scanned ${emailsScanned} emails, found ${totalFound}, inserted ${totalInserted}, errors ${errors}${timedOut ? ' (timed out)' : ''}`);
  return { found: totalFound, inserted: totalInserted, emails_scanned: emailsScanned, errors, timed_out: timedOut };
}

async function generateApiKey(tenantId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`lovable-email-${tenantId}-integration`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}
