
-- Create security definer function to check superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'superadmin'
  )
$$;

-- Tenants: superadmin full access
CREATE POLICY "Superadmin view all tenants" ON public.tenants FOR SELECT USING (is_superadmin(auth.uid()));
CREATE POLICY "Superadmin update all tenants" ON public.tenants FOR UPDATE USING (is_superadmin(auth.uid()));
CREATE POLICY "Superadmin insert tenants" ON public.tenants FOR INSERT WITH CHECK (is_superadmin(auth.uid()));
CREATE POLICY "Superadmin delete tenants" ON public.tenants FOR DELETE USING (is_superadmin(auth.uid()));

-- Profiles: superadmin read/write all
CREATE POLICY "Superadmin view all profiles" ON public.profiles FOR SELECT USING (is_superadmin(auth.uid()));
CREATE POLICY "Superadmin update all profiles" ON public.profiles FOR UPDATE USING (is_superadmin(auth.uid()));

-- User roles: superadmin full access
CREATE POLICY "Superadmin view all user roles" ON public.user_roles FOR SELECT USING (is_superadmin(auth.uid()));
CREATE POLICY "Superadmin insert user roles" ON public.user_roles FOR INSERT WITH CHECK (is_superadmin(auth.uid()));
CREATE POLICY "Superadmin update user roles" ON public.user_roles FOR UPDATE USING (is_superadmin(auth.uid()));
CREATE POLICY "Superadmin delete user roles" ON public.user_roles FOR DELETE USING (is_superadmin(auth.uid()));

-- Cases: superadmin read/write
CREATE POLICY "Superadmin view all cases" ON public.cases FOR SELECT USING (is_superadmin(auth.uid()));
CREATE POLICY "Superadmin update all cases" ON public.cases FOR UPDATE USING (is_superadmin(auth.uid()));

-- Financial: superadmin read
CREATE POLICY "Superadmin view all financial" ON public.financial_transactions FOR SELECT USING (is_superadmin(auth.uid()));

-- Billing: superadmin read
CREATE POLICY "Superadmin view all billing" ON public.billing_collections FOR SELECT USING (is_superadmin(auth.uid()));

-- Audit logs: superadmin read/write
CREATE POLICY "Superadmin view all audit logs" ON public.audit_logs FOR SELECT USING (is_superadmin(auth.uid()));
CREATE POLICY "Superadmin insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (is_superadmin(auth.uid()));

-- Appointments: superadmin read
CREATE POLICY "Superadmin view all appointments" ON public.appointments FOR SELECT USING (is_superadmin(auth.uid()));
