
CREATE OR REPLACE FUNCTION public.delete_case_cascade(_case_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Delete fulfillment documents first (FK to case_fulfillments)
  DELETE FROM public.fulfillment_documents
  WHERE fulfillment_id IN (SELECT id FROM public.case_fulfillments WHERE case_id = _case_id);

  -- Delete all dependent records
  DELETE FROM public.documents WHERE case_id = _case_id;
  DELETE FROM public.messages WHERE case_id = _case_id;
  DELETE FROM public.movements WHERE case_id = _case_id;
  DELETE FROM public.case_notes WHERE case_id = _case_id;
  DELETE FROM public.case_activities WHERE case_id = _case_id;
  DELETE FROM public.case_fulfillments WHERE case_id = _case_id;
  DELETE FROM public.billing_collections WHERE case_id = _case_id;
  DELETE FROM public.payment_orders WHERE case_id = _case_id;
  DELETE FROM public.appointments WHERE case_id = _case_id;
  DELETE FROM public.eproc_documents WHERE case_id = _case_id;
  
  -- Nullify nullable FK references
  UPDATE public.notifications SET case_id = NULL WHERE case_id = _case_id;
  UPDATE public.dje_publications SET case_id = NULL WHERE case_id = _case_id;

  -- Finally delete the case
  DELETE FROM public.cases WHERE id = _case_id;
END;
$$;
