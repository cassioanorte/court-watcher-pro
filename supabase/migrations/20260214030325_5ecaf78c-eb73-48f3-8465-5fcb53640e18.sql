CREATE POLICY "Staff update movements"
ON public.movements
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM cases
    WHERE cases.id = movements.case_id
    AND cases.tenant_id = get_user_tenant_id(auth.uid())
  )
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);