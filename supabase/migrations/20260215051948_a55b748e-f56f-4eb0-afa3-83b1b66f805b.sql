
-- Table to store email (IMAP) credentials per tenant for automatic polling
CREATE TABLE public.email_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  imap_host TEXT NOT NULL,
  imap_port INTEGER NOT NULL DEFAULT 993,
  imap_user TEXT NOT NULL,
  imap_password TEXT NOT NULL,
  use_tls BOOLEAN NOT NULL DEFAULT true,
  senders TEXT[] NOT NULL DEFAULT ARRAY[
    'noreply@trf4.jus.br','intimacao@trf4.jus.br','dje@trf4.jus.br','diario@trf4.jus.br',
    'noreply@tjrs.jus.br','intimacao@tjrs.jus.br','dje@tjrs.jus.br',
    'push@stj.jus.br','noreply@stj.jus.br','push@tst.jus.br','noreply@cnj.jus.br'
  ],
  last_polled_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE public.email_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage email credentials" ON public.email_credentials
  FOR ALL USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE TRIGGER update_email_credentials_updated_at
  BEFORE UPDATE ON public.email_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
