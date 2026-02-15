
-- CRM Lead stages enum
CREATE TYPE public.crm_stage AS ENUM (
  'contato_inicial',
  'reuniao_agendada',
  'proposta_enviada',
  'negociacao',
  'fechado_ganho',
  'fechado_perdido'
);

-- CRM Leads table
CREATE TABLE public.crm_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  cpf TEXT,
  company TEXT,
  origin TEXT, -- indicação, site, redes sociais, etc.
  stage crm_stage NOT NULL DEFAULT 'contato_inicial',
  notes TEXT,
  estimated_value NUMERIC DEFAULT 0,
  assigned_to UUID, -- staff member responsible
  converted_client_id UUID, -- links to profiles.user_id when converted
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view tenant leads" ON public.crm_leads FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Staff insert leads" ON public.crm_leads FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'staff')));

CREATE POLICY "Staff update leads" ON public.crm_leads FOR UPDATE
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'staff')));

CREATE POLICY "Staff delete leads" ON public.crm_leads FOR DELETE
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'staff')));

CREATE POLICY "Superadmin view all leads" ON public.crm_leads FOR SELECT
  USING (is_superadmin(auth.uid()));

-- CRM Interactions table
CREATE TABLE public.crm_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  type TEXT NOT NULL, -- 'call', 'email', 'meeting', 'whatsapp', 'note'
  description TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view tenant interactions" ON public.crm_interactions FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Staff insert interactions" ON public.crm_interactions FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'staff')));

CREATE POLICY "Staff delete interactions" ON public.crm_interactions FOR DELETE
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'staff')));

CREATE POLICY "Superadmin view all interactions" ON public.crm_interactions FOR SELECT
  USING (is_superadmin(auth.uid()));

-- CRM Tasks table (follow-ups)
CREATE TABLE public.crm_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  assigned_to UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view tenant tasks" ON public.crm_tasks FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Staff insert tasks" ON public.crm_tasks FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'staff')));

CREATE POLICY "Staff update tasks" ON public.crm_tasks FOR UPDATE
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'staff')));

CREATE POLICY "Staff delete tasks" ON public.crm_tasks FOR DELETE
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'staff')));

CREATE POLICY "Superadmin view all tasks" ON public.crm_tasks FOR SELECT
  USING (is_superadmin(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_crm_leads_updated_at
  BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Indexes
CREATE INDEX idx_crm_leads_tenant ON public.crm_leads(tenant_id);
CREATE INDEX idx_crm_leads_stage ON public.crm_leads(tenant_id, stage);
CREATE INDEX idx_crm_interactions_lead ON public.crm_interactions(lead_id);
CREATE INDEX idx_crm_tasks_lead ON public.crm_tasks(lead_id);
CREATE INDEX idx_crm_tasks_due ON public.crm_tasks(tenant_id, due_date, completed);
