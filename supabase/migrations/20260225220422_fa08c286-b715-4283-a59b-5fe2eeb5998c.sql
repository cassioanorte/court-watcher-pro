
-- Trigger function: when a movement is inserted on a case with pending payment orders,
-- notify all staff/owners of that tenant via the notifications table
CREATE OR REPLACE FUNCTION public.notify_payment_case_movement()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  _tenant_id UUID;
  _process_number TEXT;
  _user RECORD;
BEGIN
  -- Check if this case has any pending payment orders
  SELECT c.tenant_id, c.process_number
    INTO _tenant_id, _process_number
    FROM public.cases c
    WHERE c.id = NEW.case_id
      AND EXISTS (
        SELECT 1 FROM public.payment_orders po
        WHERE po.case_id = c.id
          AND po.status NOT IN ('sacado', 'rascunho')
      );

  IF _tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Insert notification for every staff/owner in this tenant
  FOR _user IN
    SELECT ur.user_id
    FROM public.user_roles ur
    JOIN public.profiles p ON p.user_id = ur.user_id AND p.tenant_id = _tenant_id
    WHERE ur.role IN ('owner', 'staff')
  LOOP
    INSERT INTO public.notifications (user_id, title, body, case_id)
    VALUES (
      _user.user_id,
      '⚠️ Movimentação — ' || COALESCE(_process_number, 'Processo'),
      COALESCE(NEW.title, 'Nova movimentação detectada'),
      NEW.case_id
    );
  END LOOP;

  -- Try to send push notifications via pg_net if available
  BEGIN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/manage-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'action', 'send-to-tenant',
        'tenant_id', _tenant_id::text,
        'title', '⚠️ Movimentação — ' || COALESCE(_process_number, 'Processo'),
        'body', COALESCE(NEW.title, 'Nova movimentação detectada'),
        'url', '/processos/' || NEW.case_id,
        'tag', 'payment-movement'
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- pg_net not available or call failed — notifications table is enough
    NULL;
  END;

  RETURN NEW;
END;
$function$;

-- Attach trigger to movements table
DROP TRIGGER IF EXISTS trg_payment_case_movement ON public.movements;
CREATE TRIGGER trg_payment_case_movement
  AFTER INSERT ON public.movements
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_payment_case_movement();
