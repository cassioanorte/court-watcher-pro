
-- Roles enum
CREATE TYPE public.app_role AS ENUM ('owner', 'staff', 'client');

-- Tenants (law firms)
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#c8972e',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  oab_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles (separate table for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Get tenant_id for a user
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- Process sources enum
CREATE TYPE public.process_source AS ENUM ('TJRS_1G', 'TJRS_2G', 'TRF4_JFRS', 'TRF4_JFSC', 'TRF4_JFPR');

-- Cases/Processes
CREATE TABLE public.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  responsible_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  process_number TEXT NOT NULL,
  source public.process_source NOT NULL,
  subject TEXT,
  simple_status TEXT DEFAULT 'Cadastrado',
  next_step TEXT,
  tags TEXT[] DEFAULT '{}',
  automation_enabled BOOLEAN DEFAULT false,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

-- Movements
CREATE TABLE public.movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL,
  title TEXT NOT NULL,
  details TEXT,
  translation TEXT,
  source_raw TEXT,
  source_label TEXT,
  unique_hash TEXT NOT NULL,
  is_manual BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(case_id, unique_hash)
);
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;

-- Documents
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  category TEXT,
  file_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Notification log
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Audit log
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Translation dictionary (editable by firm)
CREATE TABLE public.translation_dictionary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  original_term TEXT NOT NULL,
  simplified_term TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.translation_dictionary ENABLE ROW LEVEL SECURITY;

-- Eproc credentials (encrypted storage for optional auth mode)
CREATE TABLE public.eproc_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source public.process_source NOT NULL,
  mode TEXT NOT NULL DEFAULT 'public' CHECK (mode IN ('public', 'credential')),
  encrypted_credentials TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, source)
);
ALTER TABLE public.eproc_credentials ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Tenants: users can see their own tenant
CREATE POLICY "Users view own tenant" ON public.tenants
  FOR SELECT USING (id = public.get_user_tenant_id(auth.uid()));

-- Profiles: users see profiles in their tenant
CREATE POLICY "Users view tenant profiles" ON public.profiles
  FOR SELECT USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- User roles: users can view their own roles
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());

-- Cases: tenant isolation + client sees own
CREATE POLICY "Staff view tenant cases" ON public.cases
  FOR SELECT USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Staff insert cases" ON public.cases
  FOR INSERT WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'staff'))
  );

CREATE POLICY "Staff update cases" ON public.cases
  FOR UPDATE USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'staff'))
  );

-- Movements: follow case access
CREATE POLICY "View movements" ON public.movements
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.cases WHERE cases.id = movements.case_id AND cases.tenant_id = public.get_user_tenant_id(auth.uid()))
  );

CREATE POLICY "Insert movements" ON public.movements
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.cases WHERE cases.id = movements.case_id AND cases.tenant_id = public.get_user_tenant_id(auth.uid()))
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'staff'))
  );

-- Documents: follow case access
CREATE POLICY "View documents" ON public.documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.cases WHERE cases.id = documents.case_id AND cases.tenant_id = public.get_user_tenant_id(auth.uid()))
  );

CREATE POLICY "Upload documents" ON public.documents
  FOR INSERT WITH CHECK (uploaded_by = auth.uid());

-- Messages: follow case access, internal only for staff
CREATE POLICY "View messages" ON public.messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.cases WHERE cases.id = messages.case_id AND cases.tenant_id = public.get_user_tenant_id(auth.uid()))
    AND (NOT is_internal OR public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'staff'))
  );

CREATE POLICY "Send messages" ON public.messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

-- Notifications: user sees own
CREATE POLICY "View own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Update own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Audit logs: owner/staff view
CREATE POLICY "Staff view audit logs" ON public.audit_logs
  FOR SELECT USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'staff'))
  );

-- Translation dictionary: tenant access
CREATE POLICY "View translations" ON public.translation_dictionary
  FOR SELECT USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Manage translations" ON public.translation_dictionary
  FOR ALL USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'staff'))
  );

-- Eproc credentials: owner only
CREATE POLICY "Owner manages credentials" ON public.eproc_credentials
  FOR ALL USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND public.has_role(auth.uid(), 'owner')
  );

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_cases_updated_at BEFORE UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto-create profile trigger (after signup, needs tenant context via metadata)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, tenant_id, full_name)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'tenant_id')::UUID, NULL),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'client')
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime for messages and movements
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.movements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
