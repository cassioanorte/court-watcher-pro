-- Allow staff/owner to delete task assignments in their tenant
CREATE POLICY "Staff delete task assignments"
ON public.task_assignments
FOR DELETE
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);