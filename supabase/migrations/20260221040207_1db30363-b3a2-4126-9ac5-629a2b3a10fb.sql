
CREATE OR REPLACE FUNCTION public.can_view_case(_user_id uuid, _case_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT
    -- Superadmins can see everything
    is_superadmin(_user_id)
    OR
    -- Owners can see everything in their tenant
    (has_role(_user_id, 'owner'::app_role) AND EXISTS (
      SELECT 1 FROM cases WHERE id = _case_id AND tenant_id = get_user_tenant_id(_user_id)
    ))
    OR
    -- Clients can see their own cases
    (has_role(_user_id, 'client'::app_role) AND EXISTS (
      SELECT 1 FROM cases WHERE id = _case_id AND tenant_id = get_user_tenant_id(_user_id) AND client_user_id = _user_id
    ))
    OR
    -- Staff access based on config
    (
      has_role(_user_id, 'staff'::app_role)
      AND EXISTS (
        SELECT 1 FROM cases c WHERE c.id = _case_id AND c.tenant_id = get_user_tenant_id(_user_id)
      )
      AND (
        -- No config row means default: own cases (by responsible_user_id OR by OAB in publications)
        (
          NOT EXISTS (SELECT 1 FROM staff_case_access WHERE user_id = _user_id AND tenant_id = get_user_tenant_id(_user_id))
          AND (
            EXISTS (SELECT 1 FROM cases WHERE id = _case_id AND responsible_user_id = _user_id)
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
        -- Has config row - check access_mode
        EXISTS (
          SELECT 1 FROM staff_case_access sca
          WHERE sca.user_id = _user_id
          AND sca.tenant_id = get_user_tenant_id(_user_id)
          AND (
            sca.access_mode = 'all'
            OR (sca.access_mode = 'own_only' AND (
              EXISTS (SELECT 1 FROM cases WHERE id = _case_id AND responsible_user_id = _user_id)
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
              EXISTS (SELECT 1 FROM cases WHERE id = _case_id AND responsible_user_id = _user_id)
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
              EXISTS (SELECT 1 FROM cases WHERE id = _case_id AND responsible_user_id = _user_id)
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
$$;
