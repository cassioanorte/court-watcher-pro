
-- Table for documents attached to fulfillments
CREATE TABLE public.fulfillment_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fulfillment_id UUID NOT NULL REFERENCES public.case_fulfillments(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fulfillment_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view fulfillment docs in their tenant"
  ON public.fulfillment_documents FOR SELECT
  USING (tenant_id IN (SELECT p.tenant_id FROM profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "Users can insert fulfillment docs in their tenant"
  ON public.fulfillment_documents FOR INSERT
  WITH CHECK (tenant_id IN (SELECT p.tenant_id FROM profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "Users can delete fulfillment docs in their tenant"
  ON public.fulfillment_documents FOR DELETE
  USING (tenant_id IN (SELECT p.tenant_id FROM profiles p WHERE p.user_id = auth.uid()));
