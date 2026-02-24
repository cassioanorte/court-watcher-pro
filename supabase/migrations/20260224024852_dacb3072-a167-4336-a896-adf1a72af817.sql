CREATE OR REPLACE FUNCTION public.get_email_by_cpf(_cpf text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT au.email
  FROM public.profiles p
  JOIN auth.users au ON au.id = p.user_id
  WHERE REGEXP_REPLACE(p.cpf, '[^0-9]', '', 'g') = REGEXP_REPLACE(_cpf, '[^0-9]', '', 'g')
  LIMIT 1
$function$