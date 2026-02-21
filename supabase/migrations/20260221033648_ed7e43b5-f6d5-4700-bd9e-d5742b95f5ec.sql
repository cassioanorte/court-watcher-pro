
-- Drop the broad staff SELECT policy that allows all staff to see all tenant cases
DROP POLICY IF EXISTS "Staff view tenant cases" ON public.cases;

-- Replace with a policy that uses can_view_case for granular access
CREATE POLICY "Staff view tenant cases"
  ON public.cases FOR SELECT
  USING (can_view_case(auth.uid(), id));
