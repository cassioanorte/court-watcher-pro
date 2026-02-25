
-- Table to log all notifications/communications sent to clients
CREATE TABLE public.client_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  client_user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'email',
  title TEXT NOT NULL,
  body TEXT,
  metadata JSONB,
  sent_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_notifications ENABLE ROW LEVEL SECURITY;

-- Staff can view notifications in their tenant
CREATE POLICY "Staff view client notifications"
ON public.client_notifications FOR SELECT
USING (
  (tenant_id = get_user_tenant_id(auth.uid()))
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);

-- Staff can insert notifications
CREATE POLICY "Staff insert client notifications"
ON public.client_notifications FOR INSERT
WITH CHECK (
  (tenant_id = get_user_tenant_id(auth.uid()))
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);

-- Clients can view their own notifications
CREATE POLICY "Clients view own notifications"
ON public.client_notifications FOR SELECT
USING (client_user_id = auth.uid());

-- Index for fast lookups
CREATE INDEX idx_client_notifications_client ON public.client_notifications(client_user_id, created_at DESC);
CREATE INDEX idx_client_notifications_tenant ON public.client_notifications(tenant_id);
