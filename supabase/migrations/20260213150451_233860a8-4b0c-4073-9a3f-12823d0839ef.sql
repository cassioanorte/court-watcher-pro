
-- Allow owner/staff to view roles of users in their tenant
CREATE POLICY "Staff view tenant user roles" ON public.user_roles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = user_roles.user_id
        AND p.tenant_id = public.get_user_tenant_id(auth.uid())
    )
  );

-- Allow owner to update tenant settings
CREATE POLICY "Owner updates tenant" ON public.tenants
  FOR UPDATE USING (
    id = public.get_user_tenant_id(auth.uid())
    AND public.has_role(auth.uid(), 'owner')
  );
