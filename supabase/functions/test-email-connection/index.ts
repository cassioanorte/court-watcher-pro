const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { ImapFlow } from "npm:imapflow@1.0.164";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imap_host, imap_port, imap_user, imap_password, use_tls } = await req.json();

    if (!imap_host || !imap_user || !imap_password) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Preencha todos os campos obrigatórios.",
        error_code: "MISSING_FIELDS"
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const client = new ImapFlow({
      host: imap_host,
      port: imap_port || 993,
      secure: use_tls !== false,
      auth: { user: imap_user, pass: imap_password },
      logger: false,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    try {
      await client.connect();
      
      // Try to open INBOX to confirm full access
      const lock = await client.getMailboxLock('INBOX');
      const mailboxStatus = client.mailbox;
      lock.release();
      
      await client.logout().catch(() => {});

      return new Response(JSON.stringify({ 
        success: true,
        message: `Conexão bem-sucedida! Caixa de entrada com ${mailboxStatus?.exists || 0} e-mail(s).`,
        inbox_count: mailboxStatus?.exists || 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err: any) {
      await client.logout().catch(() => {});
      
      const errorMsg = err.message || String(err);
      const responseText = err.responseText || '';
      const isAuthError = err.authenticationFailed || 
        errorMsg.includes('AUTHENTICATIONFAILED') || 
        responseText.includes('Authentication failed');
      const isHostError = errorMsg.includes('ENOTFOUND') || 
        errorMsg.includes('getaddrinfo') ||
        errorMsg.includes('ECONNREFUSED');
      const isTimeoutError = errorMsg.includes('timeout') || 
        errorMsg.includes('ETIMEDOUT');
      const isTlsError = errorMsg.includes('TLS') || 
        errorMsg.includes('SSL') ||
        errorMsg.includes('certificate');

      let userMessage: string;
      let errorCode: string;
      let hint: string;

      if (isAuthError) {
        errorCode = "AUTH_FAILED";
        userMessage = "Autenticação falhou. Usuário ou senha incorretos.";
        hint = imap_host.includes('gmail') 
          ? "Para Gmail, use uma 'Senha de App' de 16 caracteres ao invés da senha normal. Acesse: myaccount.google.com/apppasswords"
          : imap_host.includes('outlook') || imap_host.includes('office365')
          ? "Para Outlook/Microsoft 365, verifique se o acesso IMAP está habilitado e se está usando a senha correta (ou senha de app se tiver 2FA)."
          : "Verifique se o e-mail e a senha estão corretos. Alguns provedores exigem uma 'Senha de App' separada.";
      } else if (isHostError) {
        errorCode = "HOST_NOT_FOUND";
        userMessage = `Servidor '${imap_host}' não encontrado.`;
        hint = `Verifique se o endereço do servidor IMAP está correto. Para e-mails com domínio próprio (ex: @suaempresa.com.br), consulte seu provedor de hospedagem para obter o servidor IMAP correto.`;
      } else if (isTimeoutError) {
        errorCode = "TIMEOUT";
        userMessage = "Conexão expirou. O servidor não respondeu a tempo.";
        hint = "Verifique se o servidor e a porta estão corretos. Tente a porta 993 (TLS) ou 143 (sem TLS).";
      } else if (isTlsError) {
        errorCode = "TLS_ERROR";
        userMessage = "Erro de segurança na conexão TLS/SSL.";
        hint = "Tente desativar TLS ou usar uma porta diferente (143 sem TLS, 993 com TLS).";
      } else {
        errorCode = "CONNECTION_ERROR";
        userMessage = `Erro ao conectar: ${errorMsg.substring(0, 150)}`;
        hint = "Verifique as configurações de servidor, porta e credenciais com seu provedor de e-mail.";
      }

      return new Response(JSON.stringify({ 
        success: false, 
        error: userMessage,
        error_code: errorCode,
        hint,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

  } catch (error: any) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Erro interno',
      error_code: "INTERNAL_ERROR",
      hint: "Tente novamente. Se o problema persistir, verifique os dados informados."
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
