import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    if (billErr) {
      console.error("[billing-reminders] Error fetching bills:", billErr.message);
      throw billErr;
    }

    if (!dueBills || dueBills.length === 0) {
      console.log("[billing-reminders] No bills due in 3 days");
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[billing-reminders] Found ${dueBills.length} bills due on ${targetDate}`);

    // Get client names
    const clientIds = [...new Set(dueBills.map(b => b.client_user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", clientIds);
    const nameMap: Record<string, string> = {};
    (profiles || []).forEach(p => { nameMap[p.user_id] = p.full_name; });

    let sentCount = 0;

    for (const bill of dueBills) {
      const clientName = nameMap[bill.client_user_id] || "Cliente";
      const amount = Number(bill.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      const dueFormatted = bill.due_date.split("-").reverse().join("/");

      // Check if we already sent a notification for this bill today
      const markerTag = `[BILL:${bill.id}]`;
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

      // Send client notification
      const { error: notifErr } = await supabase
        .from("client_notifications")
        .insert({
          tenant_id: bill.tenant_id,
          client_user_id: bill.client_user_id,
          sent_by: bill.created_by,
          type: "billing",
          title: `Lembrete de pagamento — ${bill.description || "Cobrança"}`,
          body: `Olá ${clientName}, este é um lembrete automático de que o pagamento de ${amount} referente a "${bill.description || "cobrança"}" vence em ${dueFormatted}. Por favor, efetue o pagamento até a data de vencimento. ${markerTag}`,
        });

      if (notifErr) {
        console.error(`[billing-reminders] Error sending notification for bill ${bill.id}:`, notifErr.message);
      } else {
        sentCount++;
        console.log(`[billing-reminders] Sent notification to ${clientName} for bill ${bill.id}`);
      }
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
