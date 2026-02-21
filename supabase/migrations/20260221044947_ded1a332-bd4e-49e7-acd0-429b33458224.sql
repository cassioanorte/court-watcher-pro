
-- Table for substabelecimentos (power of attorney transfers)
CREATE TABLE public.substabelecimentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  from_user_id UUID NOT NULL,
  to_user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('com_reservas', 'sem_reservas')),
  notes TEXT,
  document_url TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for case activity history (audit trail per process)
CREATE TABLE public.case_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID,
  action_type TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.substabelecimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_activities ENABLE ROW LEVEL SECURITY;

-- RLS for substabelecimentos
CREATE POLICY "Staff view tenant substabelecimentos"
ON public.substabelecimentos FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Staff insert substabelecimentos"
ON public.substabelecimentos FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);

CREATE POLICY "Owner delete substabelecimentos"
ON public.substabelecimentos FOR DELETE
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_role(auth.uid(), 'owner'::app_role)
);

CREATE POLICY "Superadmin view all substabelecimentos"
ON public.substabelecimentos FOR SELECT
USING (is_superadmin(auth.uid()));

-- RLS for case_activities
CREATE POLICY "Staff view tenant case activities"
ON public.case_activities FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Staff insert case activities"
ON public.case_activities FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);

CREATE POLICY "Superadmin view all case activities"
ON public.case_activities FOR SELECT
USING (is_superadmin(auth.uid()));

-- Indexes for performance
CREATE INDEX idx_substabelecimentos_case_id ON public.substabelecimentos(case_id);
CREATE INDEX idx_substabelecimentos_tenant_id ON public.substabelecimentos(tenant_id);
CREATE INDEX idx_case_activities_case_id ON public.case_activities(case_id);
CREATE INDEX idx_case_activities_tenant_id ON public.case_activities(tenant_id);
CREATE INDEX idx_case_activities_created_at ON public.case_activities(created_at DESC);
