
-- Create appointments table for calendar
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_at TIMESTAMP WITH TIME ZONE NOT NULL,
  end_at TIMESTAMP WITH TIME ZONE NOT NULL,
  color TEXT DEFAULT '#c8972e',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Staff can view all tenant appointments
CREATE POLICY "View tenant appointments"
ON public.appointments FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Staff can insert appointments
CREATE POLICY "Staff insert appointments"
ON public.appointments FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'staff'))
);

-- Staff can update appointments
CREATE POLICY "Staff update appointments"
ON public.appointments FOR UPDATE
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'staff'))
);

-- Staff can delete appointments
CREATE POLICY "Staff delete appointments"
ON public.appointments FOR DELETE
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'staff'))
);

-- Trigger for updated_at
CREATE TRIGGER update_appointments_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();
