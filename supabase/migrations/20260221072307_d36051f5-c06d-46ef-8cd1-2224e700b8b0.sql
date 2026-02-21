
-- Create reminders table
CREATE TABLE public.reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  created_by UUID NOT NULL,
  assigned_to UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  due_time TIME,
  category TEXT NOT NULL DEFAULT 'pessoal',
  case_id UUID REFERENCES public.cases(id),
  client_user_id UUID,
  tagged_user_id UUID,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- Users can view reminders assigned to them or created by them
CREATE POLICY "View own reminders"
ON public.reminders FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (assigned_to = auth.uid() OR created_by = auth.uid())
);

-- Staff/owner can insert reminders
CREATE POLICY "Staff insert reminders"
ON public.reminders FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);

-- Users can update reminders assigned to them or created by them
CREATE POLICY "Update own reminders"
ON public.reminders FOR UPDATE
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (assigned_to = auth.uid() OR created_by = auth.uid())
);

-- Users can delete reminders they created
CREATE POLICY "Delete own reminders"
ON public.reminders FOR DELETE
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (created_by = auth.uid() OR has_role(auth.uid(), 'owner'::app_role))
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.reminders;
