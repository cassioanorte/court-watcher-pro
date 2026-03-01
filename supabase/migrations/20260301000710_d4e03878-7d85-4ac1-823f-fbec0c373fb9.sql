
-- Junction table for many-to-many case <-> contact relationship
CREATE TABLE public.case_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  contact_user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(case_id, contact_user_id)
);

-- Enable RLS
ALTER TABLE public.case_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Staff view tenant case_contacts" ON public.case_contacts
  FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Staff insert case_contacts" ON public.case_contacts
  FOR INSERT WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
  );

CREATE POLICY "Staff delete case_contacts" ON public.case_contacts
  FOR DELETE USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
  );
