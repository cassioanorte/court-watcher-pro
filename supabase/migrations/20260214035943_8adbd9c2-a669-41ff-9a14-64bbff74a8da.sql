-- Allow staff/owner to delete cases from their tenant
CREATE POLICY "Staff delete cases"
ON public.cases
FOR DELETE
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);

-- Also allow deleting related movements and documents when a case is deleted
-- Add cascade behavior for movements
CREATE POLICY "Staff delete movements"
ON public.movements
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM cases
    WHERE cases.id = movements.case_id
    AND cases.tenant_id = get_user_tenant_id(auth.uid())
  )
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);

-- Allow deleting documents
CREATE POLICY "Staff delete documents"
ON public.documents
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM cases
    WHERE cases.id = documents.case_id
    AND cases.tenant_id = get_user_tenant_id(auth.uid())
  )
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);

-- Allow deleting messages
CREATE POLICY "Staff delete messages"
ON public.messages
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM cases
    WHERE cases.id = messages.case_id
    AND cases.tenant_id = get_user_tenant_id(auth.uid())
  )
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);