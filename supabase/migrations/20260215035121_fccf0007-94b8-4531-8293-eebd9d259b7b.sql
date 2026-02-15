
-- Fix RLS policies for all tables to restrict SELECT to authenticated users within the same tenant

-- ============ PROFILES ============
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in same tenant" ON public.profiles;
CREATE POLICY "Users can view profiles in same tenant"
  ON public.profiles FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- ============ TENANTS ============
DROP POLICY IF EXISTS "Tenants are viewable by everyone" ON public.tenants;
DROP POLICY IF EXISTS "Anyone can view tenants" ON public.tenants;
DROP POLICY IF EXISTS "Tenants viewable by members" ON public.tenants;
CREATE POLICY "Tenants viewable by members"
  ON public.tenants FOR SELECT
  USING (id = public.get_user_tenant_id(auth.uid()));

-- ============ CASES ============
DROP POLICY IF EXISTS "Anyone can view cases" ON public.cases;
DROP POLICY IF EXISTS "Cases are viewable by everyone" ON public.cases;
DROP POLICY IF EXISTS "Users can view cases in same tenant" ON public.cases;
CREATE POLICY "Users can view cases in same tenant"
  ON public.cases FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- ============ FINANCIAL_TRANSACTIONS ============
DROP POLICY IF EXISTS "Anyone can view financial_transactions" ON public.financial_transactions;
DROP POLICY IF EXISTS "Financial transactions viewable by everyone" ON public.financial_transactions;
DROP POLICY IF EXISTS "Users can view financial transactions in same tenant" ON public.financial_transactions;
CREATE POLICY "Users can view financial transactions in same tenant"
  ON public.financial_transactions FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- ============ BILLING_COLLECTIONS ============
DROP POLICY IF EXISTS "Anyone can view billing_collections" ON public.billing_collections;
DROP POLICY IF EXISTS "Billing collections viewable by everyone" ON public.billing_collections;
DROP POLICY IF EXISTS "Users can view billing collections in same tenant" ON public.billing_collections;
CREATE POLICY "Users can view billing collections in same tenant"
  ON public.billing_collections FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- ============ DJE_PUBLICATIONS ============
DROP POLICY IF EXISTS "Anyone can view dje_publications" ON public.dje_publications;
DROP POLICY IF EXISTS "DJE publications viewable by everyone" ON public.dje_publications;
DROP POLICY IF EXISTS "Users can view dje publications in same tenant" ON public.dje_publications;
CREATE POLICY "Users can view dje publications in same tenant"
  ON public.dje_publications FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- ============ APPOINTMENTS ============
DROP POLICY IF EXISTS "Anyone can view appointments" ON public.appointments;
DROP POLICY IF EXISTS "Appointments viewable by everyone" ON public.appointments;
DROP POLICY IF EXISTS "Users can view appointments in same tenant" ON public.appointments;
CREATE POLICY "Users can view appointments in same tenant"
  ON public.appointments FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- ============ DOCUMENTS ============
DROP POLICY IF EXISTS "Anyone can view documents" ON public.documents;
DROP POLICY IF EXISTS "Documents viewable by everyone" ON public.documents;
DROP POLICY IF EXISTS "Users can view documents in same tenant" ON public.documents;
CREATE POLICY "Users can view documents in same tenant"
  ON public.documents FOR SELECT
  USING (
    case_id IN (
      SELECT id FROM public.cases WHERE tenant_id = public.get_user_tenant_id(auth.uid())
    )
  );

-- ============ MESSAGES ============
DROP POLICY IF EXISTS "Anyone can view messages" ON public.messages;
DROP POLICY IF EXISTS "Messages viewable by everyone" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages in same tenant" ON public.messages;
CREATE POLICY "Users can view messages in same tenant"
  ON public.messages FOR SELECT
  USING (
    case_id IN (
      SELECT id FROM public.cases WHERE tenant_id = public.get_user_tenant_id(auth.uid())
    )
  );

-- ============ MOVEMENTS ============
DROP POLICY IF EXISTS "Anyone can view movements" ON public.movements;
DROP POLICY IF EXISTS "Movements viewable by everyone" ON public.movements;
DROP POLICY IF EXISTS "Users can view movements in same tenant" ON public.movements;
CREATE POLICY "Users can view movements in same tenant"
  ON public.movements FOR SELECT
  USING (
    case_id IN (
      SELECT id FROM public.cases WHERE tenant_id = public.get_user_tenant_id(auth.uid())
    )
  );

-- ============ AUDIT_LOGS ============
DROP POLICY IF EXISTS "Anyone can view audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Audit logs viewable by everyone" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can view audit logs in same tenant" ON public.audit_logs;
CREATE POLICY "Users can view audit logs in same tenant"
  ON public.audit_logs FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- ============ EPROC_CREDENTIALS ============
DROP POLICY IF EXISTS "Anyone can view eproc_credentials" ON public.eproc_credentials;
DROP POLICY IF EXISTS "Eproc credentials viewable by everyone" ON public.eproc_credentials;
DROP POLICY IF EXISTS "Users can view eproc credentials in same tenant" ON public.eproc_credentials;
CREATE POLICY "Users can view eproc credentials in same tenant"
  ON public.eproc_credentials FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- ============ NOTIFICATIONS ============
DROP POLICY IF EXISTS "Anyone can view notifications" ON public.notifications;
DROP POLICY IF EXISTS "Notifications viewable by everyone" ON public.notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

-- ============ TRANSLATION_DICTIONARY ============
DROP POLICY IF EXISTS "Anyone can view translation_dictionary" ON public.translation_dictionary;
DROP POLICY IF EXISTS "Translation dictionary viewable by everyone" ON public.translation_dictionary;
DROP POLICY IF EXISTS "Users can view translations in same tenant" ON public.translation_dictionary;
CREATE POLICY "Users can view translations in same tenant"
  ON public.translation_dictionary FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- ============ USER_ROLES ============
DROP POLICY IF EXISTS "Anyone can view user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "User roles viewable by everyone" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());
