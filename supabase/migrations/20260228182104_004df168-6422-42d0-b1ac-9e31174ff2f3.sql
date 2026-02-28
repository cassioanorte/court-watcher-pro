
-- Add responsible_user_ids array column
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS responsible_user_ids uuid[] DEFAULT '{}';

-- Populate from existing responsible_user_id
UPDATE public.cases 
SET responsible_user_ids = ARRAY[responsible_user_id] 
WHERE responsible_user_id IS NOT NULL AND (responsible_user_ids IS NULL OR responsible_user_ids = '{}');

-- Update can_view_case to also check responsible_user_ids array
CREATE OR REPLACE FUNCTION public.can_view_case(_user_id uuid, _case_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    is_superadmin(_user_id)
    OR
    (has_role(_user_id, 'owner'::app_role) AND EXISTS (
      SELECT 1 FROM cases WHERE id = _case_id AND tenant_id = get_user_tenant_id(_user_id)
    ))
    OR
    (has_role(_user_id, 'client'::app_role) AND EXISTS (
      SELECT 1 FROM cases WHERE id = _case_id AND tenant_id = get_user_tenant_id(_user_id) AND client_user_id = _user_id
    ))
    OR
    (
      has_role(_user_id, 'staff'::app_role)
      AND EXISTS (
        SELECT 1 FROM cases c WHERE c.id = _case_id AND c.tenant_id = get_user_tenant_id(_user_id)
      )
      AND (
        NOT EXISTS (
          SELECT 1 FROM staff_case_access sca
          WHERE sca.user_id = _user_id
          AND sca.tenant_id = get_user_tenant_id(_user_id)
          AND _case_id = ANY(sca.blocked_case_ids)
        )
      )
      AND (
        EXISTS (
          SELECT 1 FROM staff_case_access sca
          WHERE sca.user_id = _user_id
          AND sca.tenant_id = get_user_tenant_id(_user_id)
          AND _case_id = ANY(sca.extra_case_ids)
        )
        OR
        (
          NOT EXISTS (SELECT 1 FROM staff_case_access WHERE user_id = _user_id AND tenant_id = get_user_tenant_id(_user_id))
          AND (
            EXISTS (SELECT 1 FROM cases WHERE id = _case_id AND (responsible_user_id = _user_id OR _user_id = ANY(responsible_user_ids)))
            OR EXISTS (
              SELECT 1 FROM dje_publications dp
              JOIN profiles p ON p.user_id = _user_id
              WHERE dp.case_id = _case_id
              AND p.oab_number IS NOT NULL
              AND (
                dp.oab_number = p.oab_number
                OR dp.oab_number = REPLACE(REPLACE(p.oab_number, 'OAB/', ''), ' ', '0')
                OR REPLACE(REPLACE(REPLACE(dp.oab_number, 'OAB/', ''), '/', ''), ' ', '') 
                  = REPLACE(REPLACE(REPLACE(p.oab_number, 'OAB/', ''), '/', ''), ' ', '')
              )
            )
          )
        )
        OR
        EXISTS (
          SELECT 1 FROM staff_case_access sca
          WHERE sca.user_id = _user_id
          AND sca.tenant_id = get_user_tenant_id(_user_id)
          AND (
            sca.access_mode = 'all'
            OR (sca.access_mode = 'own_only' AND (
              EXISTS (SELECT 1 FROM cases WHERE id = _case_id AND (responsible_user_id = _user_id OR _user_id = ANY(responsible_user_ids)))
              OR EXISTS (
                SELECT 1 FROM dje_publications dp
                JOIN profiles p ON p.user_id = _user_id
                WHERE dp.case_id = _case_id
                AND p.oab_number IS NOT NULL
                AND (
                  dp.oab_number = p.oab_number
                  OR dp.oab_number = REPLACE(REPLACE(p.oab_number, 'OAB/', ''), ' ', '0')
                  OR REPLACE(REPLACE(REPLACE(dp.oab_number, 'OAB/', ''), '/', ''), ' ', '') 
                    = REPLACE(REPLACE(REPLACE(p.oab_number, 'OAB/', ''), '/', ''), ' ', '')
                )
              )
            ))
            OR (sca.access_mode = 'own_plus_oab' AND (
              EXISTS (SELECT 1 FROM cases WHERE id = _case_id AND (responsible_user_id = _user_id OR _user_id = ANY(responsible_user_ids)))
              OR EXISTS (
                SELECT 1 FROM dje_publications dp
                JOIN profiles p ON p.user_id = _user_id
                WHERE dp.case_id = _case_id
                AND p.oab_number IS NOT NULL
                AND (
                  dp.oab_number = p.oab_number
                  OR dp.oab_number = REPLACE(REPLACE(p.oab_number, 'OAB/', ''), ' ', '0')
                  OR REPLACE(REPLACE(REPLACE(dp.oab_number, 'OAB/', ''), '/', ''), ' ', '') 
                    = REPLACE(REPLACE(REPLACE(p.oab_number, 'OAB/', ''), '/', ''), ' ', '')
                )
              )
              OR EXISTS (
                SELECT 1 FROM dje_publications dp
                WHERE dp.case_id = _case_id
                AND dp.oab_number = ANY(sca.allowed_oab_numbers)
              )
              OR EXISTS (
                SELECT 1 FROM cases c2
                JOIN profiles p ON p.user_id = c2.responsible_user_id
                WHERE c2.id = _case_id AND p.oab_number = ANY(sca.allowed_oab_numbers)
              )
            ))
            OR (sca.access_mode = 'own_plus_clients' AND (
              EXISTS (SELECT 1 FROM cases WHERE id = _case_id AND (responsible_user_id = _user_id OR _user_id = ANY(responsible_user_ids)))
              OR EXISTS (
                SELECT 1 FROM dje_publications dp
                JOIN profiles p ON p.user_id = _user_id
                WHERE dp.case_id = _case_id
                AND p.oab_number IS NOT NULL
                AND (
                  dp.oab_number = p.oab_number
                  OR dp.oab_number = REPLACE(REPLACE(p.oab_number, 'OAB/', ''), ' ', '0')
                  OR REPLACE(REPLACE(REPLACE(dp.oab_number, 'OAB/', ''), '/', ''), ' ', '') 
                    = REPLACE(REPLACE(REPLACE(p.oab_number, 'OAB/', ''), '/', ''), ' ', '')
                )
              )
              OR EXISTS (
                SELECT 1 FROM cases WHERE id = _case_id AND client_user_id = ANY(sca.allowed_client_ids::uuid[])
              )
            ))
          )
        )
      )
    )
$function$;

-- Update notify_fulfillment_assigned to include cumprimento_sentenca
CREATE OR REPLACE FUNCTION public.notify_fulfillment_assigned()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _process_number TEXT;
  _category_label TEXT;
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
    ELSE NEW.category
  END;

  INSERT INTO public.notifications (user_id, title, body, case_id)
  VALUES (
    NEW.assigned_to,
    'Novo Cumprimento: ' || _category_label,
    'Processo ' || COALESCE(_process_number, 'N/A') || ' — Prazo: ' || TO_CHAR(NEW.due_date, 'DD/MM/YYYY'),
    NEW.case_id
  );

  INSERT INTO public.reminders (assigned_to, created_by, tenant_id, title, description, due_date, category, case_id)
  VALUES (
    NEW.assigned_to,
    NEW.assigned_by,
    NEW.tenant_id,
    _category_label || ' — ' || COALESCE(_process_number, 'Processo'),
    NEW.description,
    NEW.due_date,
    'cumprimento',
    NEW.case_id
  );

  RETURN NEW;
END;
$function$;
