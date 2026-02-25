-- Drop the overly permissive SELECT policies on movements
DROP POLICY IF EXISTS "Users can view movements in same tenant" ON public.movements;
DROP POLICY IF EXISTS "View movements" ON public.movements;

-- Create a proper policy: staff/owner see all tenant movements, clients only see their own cases
CREATE POLICY "View movements" ON public.movements
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM cases
    WHERE cases.id = movements.case_id
      AND cases.tenant_id = get_user_tenant_id(auth.uid())
      AND (
        -- Staff/Owner can see all
        has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role)
        -- Clients can only see movements of their own cases
        OR cases.client_user_id = auth.uid()
      )
  )
);