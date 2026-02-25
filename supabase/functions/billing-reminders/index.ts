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

async function sendPush(supabaseUrl: string, serviceRoleKey: string, targetUserId: string, title: string, body: string, tag: string) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/manage-push`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
      body: JSON.stringify({ action: "send", target_user_id: targetUserId, title, body, url: "/portal-cliente", tag }),
    });
  } catch (e) {
    console.error("[push error]", e);
  }
}

async function sendEmail(cred: any, toEmail: string, subject: string, html: string) {
  try {
    const smtpHost = getSmtpHost(cred.imap_host);
    const cfg = getSmtpConfig(smtpHost);
    const client = new SMTPClient({
      connection: { hostname: smtpHost, port: cfg.port, tls: cfg.tls, auth: { username: cred.imap_user, password: cred.imap_password } },
    });
    await client.send({ from: cred.imap_user, to: toEmail, subject, html });
    await client.close();
  } catch (e) {
    console.error("[email error]", e);
  }
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
    const todayStr = today.toISOString().split("T")[0];
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const targetDate = threeDaysFromNow.toISOString().split("T")[0];

    console.log(`[billing-reminders] Checking bills due ${targetDate} and scheduled notifications for ${todayStr}`);

    // ===== PART 1: Billing collections (existing logic) =====
    const { data: dueBills } = await supabase
      .from("billing_collections")
      .select("id, tenant_id, client_user_id, amount, due_date, description, created_by")
      .eq("due_date", targetDate)
      .in("status", ["pending", "partial"]);

    // Get all relevant profiles
    const allClientIds = new Set<string>();
    (dueBills || []).forEach(b => allClientIds.add(b.client_user_id));

    // Get scheduled notifications due today
    const { data: dueScheduled } = await supabase
      .from("scheduled_notifications")
      .select("*")
      .eq("next_send_date", todayStr)
      .eq("is_active", true);

    (dueScheduled || []).forEach(s => allClientIds.add(s.client_user_id));

    const clientIdsArr = [...allClientIds];
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", clientIdsArr.length > 0 ? clientIdsArr : ["__none__"]);
    const profileMap: Record<string, { name: string; email: string | null }> = {};
    (profiles || []).forEach(p => { profileMap[p.user_id] = { name: p.full_name, email: p.email }; });

    // Get email creds per tenant
    const allTenantIds = new Set<string>();
    (dueBills || []).forEach(b => allTenantIds.add(b.tenant_id));
    (dueScheduled || []).forEach(s => allTenantIds.add(s.tenant_id));
    const tenantArr = [...allTenantIds];
    const { data: emailCreds } = await supabase.from("email_credentials").select("tenant_id, imap_host, imap_user, imap_password, imap_port, use_tls").in("tenant_id", tenantArr.length > 0 ? tenantArr : ["__none__"]).eq("is_active", true);
    const emailCredMap: Record<string, any> = {};
    (emailCreds || []).forEach(c => { emailCredMap[c.tenant_id] = c; });

    let sentCount = 0;

    // Process billing collections
    for (const bill of (dueBills || [])) {
      const clientInfo = profileMap[bill.client_user_id] || { name: "Cliente", email: null };
      const amount = Number(bill.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      const dueFormatted = bill.due_date.split("-").reverse().join("/");
      const markerTag = `[BILL:${bill.id}]`;

      const { data: existing } = await supabase.from("client_notifications").select("id").eq("client_user_id", bill.client_user_id).eq("tenant_id", bill.tenant_id).ilike("body", `%${markerTag}%`).limit(1);
      if (existing && existing.length > 0) continue;

      const title = `Lembrete de pagamento — ${bill.description || "Cobrança"}`;
      const body = `Olá ${clientInfo.name}, este é um lembrete automático de que o pagamento de ${amount} referente a "${bill.description || "cobrança"}" vence em ${dueFormatted}. Por favor, efetue o pagamento até a data de vencimento. ${markerTag}`;

      await supabase.from("client_notifications").insert({ tenant_id: bill.tenant_id, client_user_id: bill.client_user_id, sent_by: bill.created_by, type: "billing", title, body });
      await sendPush(supabaseUrl, serviceRoleKey, bill.client_user_id, `💰 ${title}`, `Pagamento de ${amount} vence em ${dueFormatted}`, `billing-${bill.id}`);

      const cred = emailCredMap[bill.tenant_id];
      if (cred && clientInfo.email) {
        await sendEmail(cred, clientInfo.email, `🔔 ${title}`, `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <h2 style="color:#1a1a1a;">Lembrete de Pagamento</h2>
            <p>Olá <strong>${clientInfo.name}</strong>,</p>
            <p>Este é um lembrete automático sobre o seu pagamento:</p>
            <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:16px 0;">
              <p style="margin:4px 0;"><strong>Descrição:</strong> ${bill.description || "Cobrança"}</p>
              <p style="margin:4px 0;"><strong>Valor:</strong> ${amount}</p>
              <p style="margin:4px 0;"><strong>Vencimento:</strong> ${dueFormatted}</p>
            </div>
            <p>Por favor, efetue o pagamento até a data de vencimento.</p>
            <p style="color:#666;font-size:12px;margin-top:24px;">Este é um e-mail automático.</p>
          </div>`);
      }
      sentCount++;
    }

    // ===== PART 2: Scheduled notifications =====
    let scheduledSent = 0;
    for (const sn of (dueScheduled || [])) {
      const clientInfo = profileMap[sn.client_user_id] || { name: "Cliente", email: null };
      const toEmail = sn.email_override || clientInfo.email;
      const cred = emailCredMap[sn.tenant_id];

      // In-app notification
      await supabase.from("client_notifications").insert({
        tenant_id: sn.tenant_id,
        client_user_id: sn.client_user_id,
        sent_by: sn.created_by,
        type: "reminder",
        title: sn.title,
        body: sn.message,
      });

      // Push
      if (sn.channel === "all" || sn.channel === "push") {
        await sendPush(supabaseUrl, serviceRoleKey, sn.client_user_id, `🔔 ${sn.title}`, sn.message, `sched-${sn.id}`);
      }

      // Email
      if ((sn.channel === "all" || sn.channel === "email") && cred && toEmail) {
        await sendEmail(cred, toEmail, `🔔 ${sn.title}`, `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <h2 style="color:#1a1a1a;">${sn.title}</h2>
            <p>Olá <strong>${clientInfo.name}</strong>,</p>
            <p>${sn.message}</p>
            <p style="color:#666;font-size:12px;margin-top:24px;">Este é um e-mail automático.</p>
          </div>`);
      }

      // Update sent_count and next_send_date
      const newSentCount = sn.sent_count + 1;
      const finished = newSentCount >= sn.repeat_count;
      const nextDate = new Date(sn.next_send_date + "T12:00:00");
      nextDate.setMonth(nextDate.getMonth() + 1);
      nextDate.setDate(sn.day_of_month);

      await supabase.from("scheduled_notifications").update({
        sent_count: newSentCount,
        is_active: !finished,
        next_send_date: nextDate.toISOString().split("T")[0],
        updated_at: new Date().toISOString(),
      }).eq("id", sn.id);

      scheduledSent++;
    }

    console.log(`[billing-reminders] Sent ${sentCount} billing + ${scheduledSent} scheduled notifications`);

    return new Response(JSON.stringify({ billing_sent: sentCount, scheduled_sent: scheduledSent }), {
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
