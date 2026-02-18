
-- Drop the existing restrictive public policy
DROP POLICY IF EXISTS "Public view published landing pages" ON public.landing_pages;

-- Recreate as PERMISSIVE so unauthenticated users can view published pages
CREATE POLICY "Public view published landing pages"
ON public.landing_pages
FOR SELECT
USING (status = 'published');

-- Also make staff view permissive
DROP POLICY IF EXISTS "Staff view tenant landing pages" ON public.landing_pages;
CREATE POLICY "Staff view tenant landing pages"
ON public.landing_pages
FOR SELECT
USING (
  (tenant_id = get_user_tenant_id(auth.uid()))
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);

-- Superadmin view permissive
DROP POLICY IF EXISTS "Superadmin view all landing pages" ON public.landing_pages;
CREATE POLICY "Superadmin view all landing pages"
ON public.landing_pages
FOR SELECT
USING (is_superadmin(auth.uid()));
