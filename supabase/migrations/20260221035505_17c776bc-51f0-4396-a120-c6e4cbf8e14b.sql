
-- Drop the overly permissive policy that bypasses can_view_case
DROP POLICY IF EXISTS "Users can view cases in same tenant" ON public.cases;
