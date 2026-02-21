
-- Create access mode enum
CREATE TYPE public.case_access_mode AS ENUM ('all', 'own_only', 'own_plus_oab', 'own_plus_clients');

-- Create staff case access table
CREATE TABLE public.staff_case_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  access_mode case_access_mode NOT NULL DEFAULT 'own_only',
  allowed_oab_numbers TEXT[] DEFAULT '{}',
  allowed_client_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

-- Enable RLS
ALTER TABLE public.staff_case_access ENABLE ROW LEVEL SECURITY;

-- Owners can manage access rules in their tenant
CREATE POLICY "Owner manage staff access"
  ON public.staff_case_access FOR ALL
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role));

-- Staff can view their own access config
CREATE POLICY "Staff view own access"
  ON public.staff_case_access FOR SELECT
  USING (user_id = auth.uid());

-- Superadmin can view all
CREATE POLICY "Superadmin view all staff access"
  ON public.staff_case_access FOR SELECT
  USING (is_superadmin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_staff_case_access_updated_at
  BEFORE UPDATE ON public.staff_case_access
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Create a security definer function to check case visibility
CREATE OR REPLACE FUNCTION public.can_view_case(_user_id UUID, _case_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Superadmins can see everything
    is_superadmin(_user_id)
    OR
    -- Owners can see everything in their tenant
    (has_role(_user_id, 'owner'::app_role) AND EXISTS (
      SELECT 1 FROM cases WHERE id = _case_id AND tenant_id = get_user_tenant_id(_user_id)
    ))
    OR
    -- Clients can see their own cases
    (has_role(_user_id, 'client'::app_role) AND EXISTS (
      SELECT 1 FROM cases WHERE id = _case_id AND tenant_id = get_user_tenant_id(_user_id) AND client_user_id = _user_id
    ))
    OR
    -- Staff access based on config
    (
      (has_role(_user_id, 'staff'::app_role) OR has_role(_user_id, 'owner'::app_role))
      AND EXISTS (
        SELECT 1 FROM cases c WHERE c.id = _case_id AND c.tenant_id = get_user_tenant_id(_user_id)
      )
      AND (
        -- No config means default own_only
        NOT EXISTS (SELECT 1 FROM staff_case_access WHERE user_id = _user_id)
        AND EXISTS (SELECT 1 FROM cases WHERE id = _case_id AND responsible_user_id = _user_id)
      )
      OR
      (
        EXISTS (
          SELECT 1 FROM staff_case_access sca
          WHERE sca.user_id = _user_id
          AND sca.tenant_id = get_user_tenant_id(_user_id)
          AND (
            sca.access_mode = 'all'
            OR (sca.access_mode = 'own_only' AND EXISTS (
              SELECT 1 FROM cases WHERE id = _case_id AND responsible_user_id = _user_id
            ))
            OR (sca.access_mode = 'own_plus_oab' AND (
              EXISTS (SELECT 1 FROM cases WHERE id = _case_id AND responsible_user_id = _user_id)
              OR EXISTS (
                SELECT 1 FROM cases c2
                JOIN profiles p ON p.user_id = c2.responsible_user_id
                WHERE c2.id = _case_id AND p.oab_number = ANY(sca.allowed_oab_numbers)
              )
            ))
            OR (sca.access_mode = 'own_plus_clients' AND (
              EXISTS (SELECT 1 FROM cases WHERE id = _case_id AND responsible_user_id = _user_id)
              OR EXISTS (
                SELECT 1 FROM cases WHERE id = _case_id AND client_user_id = ANY(sca.allowed_client_ids)
              )
            ))
          )
        )
      )
    )
$$;
