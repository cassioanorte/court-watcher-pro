import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Map IMAP host to SMTP host
function getSmtpHost(imapHost: string): string {
  const map: Record<string, string> = {
    "imap.gmail.com": "smtp.gmail.com",
    "imap.mail.yahoo.com": "smtp.mail.yahoo.com",
    "outlook.office365.com": "smtp.office365.com",
    "imap-mail.outlook.com": "smtp-mail.outlook.com",
    "imap.zoho.com": "smtp.zoho.com",
    "imap.uol.com.br": "smtp.uol.com.br",
    "imap.terra.com.br": "smtp.terra.com.br",
    "imap.locaweb.com.br": "email-ssl.com.br",
  };
  return map[imapHost] || imapHost.replace(/^imap\./, "smtp.");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autenticado");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Não autenticado");

    const body = await req.json();
    const { clientEmail, clientName, appointmentTitle, appointmentDate, startTime, endTime, description, videoLink, tenantId } = body;

    if (!clientEmail || !tenantId) throw new Error("E-mail do cliente e tenant_id são obrigatórios");

    // Get tenant's email credentials
    const { data: creds, error: credsError } = await supabase
      .from("email_credentials")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .limit(1)
      .single();

    if (credsError || !creds) {
      throw new Error("Nenhuma credencial de e-mail ativa encontrada. Configure em Ajustes > Integrações de E-mail.");
    }

    const smtpHost = getSmtpHost(creds.imap_host);
    const smtpPort = 587;

    // Get tenant name for email branding
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", tenantId)
      .single();

    const tenantName = tenant?.name || "Escritório";

    // Build email body
    const dateFormatted = new Date(`${appointmentDate}T00:00:00`).toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    let htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Agendamento de Atendimento</h2>
        <p>Olá${clientName ? `, ${clientName}` : ""},</p>
        <p>Informamos que um atendimento foi agendado para você:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Tipo</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${appointmentTitle}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Data</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${dateFormatted}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Horário</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${startTime} às ${endTime}</td></tr>
          ${description ? `<tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Observações</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${description}</td></tr>` : ""}
        </table>
        ${videoLink ? `<p style="margin: 20px 0;"><strong>Link da videochamada:</strong><br/><a href="${videoLink}" style="color: #2563eb; text-decoration: none;">${videoLink}</a></p>` : ""}
        <p style="color: #777; font-size: 12px; margin-top: 30px;">Enviado por ${tenantName}</p>
      </div>
    `;

    // Send email via SMTP
    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: true,
        auth: {
          username: creds.imap_user,
          password: creds.imap_password,
        },
      },
    });

    await client.send({
      from: creds.imap_user,
      to: clientEmail,
      subject: `Agendamento: ${appointmentTitle} - ${dateFormatted}`,
      content: "auto",
      html: htmlBody,
    });

    await client.close();

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error sending appointment email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
