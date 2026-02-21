
-- Create dedicated task assignments table
CREATE TABLE public.task_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  case_id uuid REFERENCES public.cases(id),
  assigned_by uuid NOT NULL,
  assigned_to uuid NOT NULL,
  task_description text NOT NULL,
  process_number text,
  parties text,
  due_date date,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;

-- Users can see tasks assigned TO them or BY them in same tenant
CREATE POLICY "View own task assignments"
ON public.task_assignments
FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (assigned_to = auth.uid() OR assigned_by = auth.uid())
);

-- Staff/owner can insert
CREATE POLICY "Staff insert task assignments"
ON public.task_assignments
FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);

-- Assigned user or creator can update (mark complete)
CREATE POLICY "Update own task assignments"
ON public.task_assignments
FOR UPDATE
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (assigned_to = auth.uid() OR assigned_by = auth.uid())
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_assignments;
