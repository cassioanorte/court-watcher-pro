
CREATE OR REPLACE FUNCTION public.notify_fulfillment_assigned()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _process_number TEXT;
  _category_label TEXT;
  _uid UUID;
  _assignees UUID[];
BEGIN
  SELECT process_number INTO _process_number FROM public.cases WHERE id = NEW.case_id;
  
  _category_label := CASE NEW.category
    WHEN 'peticao' THEN 'Petição'
    WHEN 'recurso' THEN 'Recurso'
    WHEN 'cumprimento_despacho' THEN 'Cumprimento de Despacho'
    WHEN 'audiencia_diligencia' THEN 'Audiência/Diligência'
    WHEN 'contato_cliente' THEN 'Ligar para o Cliente'
    WHEN 'solicitar_documentacao' THEN 'Solicitar Documentação'
    WHEN 'manifestacao' THEN 'Manifestação'
    WHEN 'alvara' THEN 'Alvará'
    WHEN 'calculo' THEN 'Cálculo'
    WHEN 'providencia_administrativa' THEN 'Providência Administrativa'
    WHEN 'cumprimento_sentenca' THEN 'Cumprimento de Sentença'
    WHEN 'contestacao' THEN 'Contestação'
    WHEN 'replica' THEN 'Réplica'
    WHEN 'aguardando_decurso_prazo' THEN 'Aguardando Decurso do Prazo'
    ELSE NEW.category
  END;

  IF NEW.assigned_to_ids IS NOT NULL AND array_length(NEW.assigned_to_ids, 1) > 0 THEN
    _assignees := NEW.assigned_to_ids;
  ELSE
    _assignees := ARRAY[NEW.assigned_to];
  END IF;

  FOREACH _uid IN ARRAY _assignees LOOP
    INSERT INTO public.notifications (user_id, title, body, case_id)
    VALUES (
      _uid,
      'Novo Cumprimento: ' || _category_label,
      'Processo ' || COALESCE(_process_number, 'N/A') || ' — Prazo: ' || TO_CHAR(NEW.due_date, 'DD/MM/YYYY'),
      NEW.case_id
    );

    INSERT INTO public.reminders (assigned_to, created_by, tenant_id, title, description, due_date, category, case_id)
    VALUES (
      _uid,
      NEW.assigned_by,
      NEW.tenant_id,
      _category_label || ' — ' || COALESCE(_process_number, 'Processo'),
      NEW.description,
      NEW.due_date,
      'cumprimento',
      NEW.case_id
    );
  END LOOP;

  RETURN NEW;
END;
$function$;
