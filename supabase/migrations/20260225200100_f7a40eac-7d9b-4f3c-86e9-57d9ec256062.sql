
CREATE TABLE public.scheduled_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  created_by UUID NOT NULL,
  client_user_id UUID NOT NULL,
  case_id UUID REFERENCES public.cases(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  email_override TEXT,
  start_date DATE NOT NULL,
  day_of_month INT NOT NULL DEFAULT 10,
  repeat_count INT NOT NULL DEFAULT 1,
  sent_count INT NOT NULL DEFAULT 0,
  next_send_date DATE NOT NULL,
  channel TEXT NOT NULL DEFAULT 'all',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduled_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view tenant scheduled_notifications" ON public.scheduled_notifications
  FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Staff insert scheduled_notifications" ON public.scheduled_notifications
  FOR INSERT WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
  );

CREATE POLICY "Staff update scheduled_notifications" ON public.scheduled_notifications
  FOR UPDATE USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
  );

CREATE POLICY "Staff delete scheduled_notifications" ON public.scheduled_notifications
  FOR DELETE USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
  );
