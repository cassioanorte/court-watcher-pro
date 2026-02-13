
-- Add CPF column to profiles
ALTER TABLE public.profiles ADD COLUMN cpf TEXT;

-- Create unique index on cpf (only for non-null values)
CREATE UNIQUE INDEX idx_profiles_cpf ON public.profiles (cpf) WHERE cpf IS NOT NULL;

-- Create a security definer function to look up email by CPF (callable without auth)
CREATE OR REPLACE FUNCTION public.get_email_by_cpf(_cpf TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT au.email
  FROM public.profiles p
  JOIN auth.users au ON au.id = p.user_id
  WHERE p.cpf = _cpf
  LIMIT 1
$$;

-- Grant execute to anon so unauthenticated users can call it
GRANT EXECUTE ON FUNCTION public.get_email_by_cpf(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_email_by_cpf(TEXT) TO authenticated;
