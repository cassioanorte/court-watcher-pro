
-- Table for AI agents per tenant
CREATE TABLE public.ai_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  prompt TEXT NOT NULL,
  icon TEXT DEFAULT 'Bot',
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;

-- Everyone in tenant can view agents
CREATE POLICY "Staff view tenant agents"
ON public.ai_agents FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Staff/owner can create agents
CREATE POLICY "Staff insert agents"
ON public.ai_agents FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);

-- Only creator can update non-system agents, owner can update any
CREATE POLICY "Creator or owner update agents"
ON public.ai_agents FOR UPDATE
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (
    has_role(auth.uid(), 'owner'::app_role)
    OR (created_by = auth.uid() AND is_system = false)
  )
);

-- Only creator can delete non-system agents, owner can delete any
CREATE POLICY "Creator or owner delete agents"
ON public.ai_agents FOR DELETE
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (
    has_role(auth.uid(), 'owner'::app_role)
    OR (created_by = auth.uid() AND is_system = false)
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_ai_agents_updated_at
BEFORE UPDATE ON public.ai_agents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();
