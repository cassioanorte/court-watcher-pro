
CREATE TABLE public.billing_collections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  client_user_id UUID NOT NULL,
  case_id UUID REFERENCES public.cases(id),
  amount NUMERIC(12,2) NOT NULL,
  due_date DATE NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue', 'cancelled')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_billing_collections_updated_at
  BEFORE UPDATE ON public.billing_collections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.billing_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view tenant billing" ON public.billing_collections FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'staff')));

CREATE POLICY "Staff insert billing" ON public.billing_collections FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'staff')));

CREATE POLICY "Staff update billing" ON public.billing_collections FOR UPDATE
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'staff')));

CREATE POLICY "Owner delete billing" ON public.billing_collections FOR DELETE
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'owner'));
