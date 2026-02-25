import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getSmtpHost(imapHost: string): string {
  const map: Record<string, string> = {
    "imap.gmail.com": "smtp.gmail.com",
    "outlook.office365.com": "smtp-mail.outlook.com",
    "imap-mail.outlook.com": "smtp-mail.outlook.com",
  };
  return map[imapHost] || imapHost.replace(/^imap\./, "smtp.");
}

function getSmtpConfig(smtpHost: string) {
  if (smtpHost.includes("gmail") || smtpHost.includes("zoho")) {
    return { port: 465, tls: true };
  }
  return { port: 587, tls: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const today = new Date();
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const targetDate = threeDaysFromNow.toISOString().split("T")[0];

    console.log(`[billing-reminders] Checking for bills due on ${targetDate}`);

    // Find pending billing collections due in 3 days
    const { data: dueBills, error: billErr } = await supabase
      .from("billing_collections")
      .select("id, tenant_id, client_user_id, amount, due_date, description, created_by")
      .eq("due_date", targetDate)
      .in("status", ["pending", "partial"]);

    if (billErr) throw billErr;

    if (!dueBills || dueBills.length === 0) {
      console.log("[billing-reminders] No bills due in 3 days");
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[billing-reminders] Found ${dueBills.length} bills due on ${targetDate}`);

    // Get client names and emails
    const clientIds = [...new Set(dueBills.map(b => b.client_user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, email")
      .in("user_id", clientIds);
    const profileMap: Record<string, { name: string; email: string | null }> = {};
    (profiles || []).forEach(p => {
      profileMap[p.user_id] = { name: p.full_name, email: p.email };
    });

    // Get email credentials per tenant for sending emails
    const tenantIds = [...new Set(dueBills.map(b => b.tenant_id))];
    const { data: emailCreds } = await supabase
      .from("email_credentials")
      .select("tenant_id, imap_host, imap_user, imap_password, imap_port, use_tls")
      .in("tenant_id", tenantIds)
      .eq("is_active", true);
    const emailCredMap: Record<string, any> = {};
    (emailCreds || []).forEach(c => { emailCredMap[c.tenant_id] = c; });

    let sentCount = 0;

    for (const bill of dueBills) {
      const clientInfo = profileMap[bill.client_user_id] || { name: "Cliente", email: null };
      const amount = Number(bill.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      const dueFormatted = bill.due_date.split("-").reverse().join("/");
      const markerTag = `[BILL:${bill.id}]`;

      // Check if already notified
      const { data: existing } = await supabase
        .from("client_notifications")
        .select("id")
        .eq("client_user_id", bill.client_user_id)
        .eq("tenant_id", bill.tenant_id)
        .ilike("body", `%${markerTag}%`)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`[billing-reminders] Already notified for bill ${bill.id}, skipping`);
        continue;
      }

      const title = `Lembrete de pagamento — ${bill.description || "Cobrança"}`;
      const body = `Olá ${clientInfo.name}, este é um lembrete automático de que o pagamento de ${amount} referente a "${bill.description || "cobrança"}" vence em ${dueFormatted}. Por favor, efetue o pagamento até a data de vencimento. ${markerTag}`;

      // 1. In-app notification
      await supabase.from("client_notifications").insert({
        tenant_id: bill.tenant_id,
        client_user_id: bill.client_user_id,
        sent_by: bill.created_by,
        type: "billing",
        title,
        body,
      });

      // 2. Push notification
      try {
        const pushUrl = `${supabaseUrl}/functions/v1/manage-push`;
        await fetch(pushUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            action: "send",
            target_user_id: bill.client_user_id,
            title: `💰 ${title}`,
            body: `Pagamento de ${amount} vence em ${dueFormatted}`,
            url: "/portal-cliente",
            tag: `billing-${bill.id}`,
          }),
        });
        console.log(`[billing-reminders] Push sent for bill ${bill.id}`);
      } catch (pushErr) {
        console.error(`[billing-reminders] Push error for bill ${bill.id}:`, pushErr);
      }

      // 3. Email notification
      const cred = emailCredMap[bill.tenant_id];
      if (cred && clientInfo.email) {
        try {
          const smtpHost = getSmtpHost(cred.imap_host);
          const smtpConfig = getSmtpConfig(smtpHost);
          const client = new SMTPClient({
            connection: {
              hostname: smtpHost,
              port: smtpConfig.port,
              tls: smtpConfig.tls,
              auth: { username: cred.imap_user, password: cred.imap_password },
            },
          });

          await client.send({
            from: cred.imap_user,
            to: clientInfo.email,
            subject: `🔔 ${title}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #1a1a1a;">Lembrete de Pagamento</h2>
                <p>Olá <strong>${clientInfo.name}</strong>,</p>
                <p>Este é um lembrete automático sobre o seu pagamento:</p>
                <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 16px 0;">
                  <p style="margin: 4px 0;"><strong>Descrição:</strong> ${bill.description || "Cobrança"}</p>
                  <p style="margin: 4px 0;"><strong>Valor:</strong> ${amount}</p>
                  <p style="margin: 4px 0;"><strong>Vencimento:</strong> ${dueFormatted}</p>
                </div>
                <p>Por favor, efetue o pagamento até a data de vencimento para evitar encargos.</p>
                <p style="color: #666; font-size: 12px; margin-top: 24px;">Este é um e-mail automático. Em caso de dúvidas, entre em contato com seu escritório.</p>
              </div>
            `,
          });
          await client.close();
          console.log(`[billing-reminders] Email sent to ${clientInfo.email} for bill ${bill.id}`);
        } catch (emailErr) {
          console.error(`[billing-reminders] Email error for bill ${bill.id}:`, emailErr);
        }
      }

      sentCount++;
    }

    return new Response(JSON.stringify({ sent: sentCount, checked: dueBills.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[billing-reminders] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
