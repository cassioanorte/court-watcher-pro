-- Remove unique constraint on tenant_id to allow multiple email credentials per tenant
ALTER TABLE public.email_credentials DROP CONSTRAINT email_credentials_tenant_id_key;