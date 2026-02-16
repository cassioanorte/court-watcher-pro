
-- Contact-level documents (not tied to a specific case)
CREATE TABLE public.contact_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  file_url TEXT,
  link_url TEXT,
  category TEXT NOT NULL DEFAULT 'Escritório',
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view tenant contact documents"
ON public.contact_documents FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Staff insert contact documents"
ON public.contact_documents FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid()) AND
  (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR uploaded_by = auth.uid())
);

CREATE POLICY "Staff delete contact documents"
ON public.contact_documents FOR DELETE
USING (
  tenant_id = get_user_tenant_id(auth.uid()) AND
  (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);
