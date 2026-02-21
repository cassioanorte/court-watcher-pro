
-- Drop the restrictive public policy and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Public view all landing pages by slug" ON public.landing_pages;

CREATE POLICY "Public view all landing pages by slug"
ON public.landing_pages
FOR SELECT
TO anon, authenticated
USING (true);

-- Also fix the other SELECT policies to be permissive
DROP POLICY IF EXISTS "Staff view tenant landing pages" ON public.landing_pages;
CREATE POLICY "Staff view tenant landing pages"
ON public.landing_pages
FOR SELECT
TO authenticated
USING (
  (tenant_id = get_user_tenant_id(auth.uid()))
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);

DROP POLICY IF EXISTS "Superadmin view all landing pages" ON public.landing_pages;
CREATE POLICY "Superadmin view all landing pages"
ON public.landing_pages
FOR SELECT
TO authenticated
USING (is_superadmin(auth.uid()));
