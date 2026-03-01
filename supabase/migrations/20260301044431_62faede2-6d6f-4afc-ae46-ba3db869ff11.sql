
-- Restore Dr. Rodrigo's profile
INSERT INTO public.profiles (user_id, tenant_id, full_name, email, phone, oab_number, position)
VALUES (
  'e97f4526-2a4a-4333-84fe-a0162c26cc90',
  'a5a3b8fc-8031-4ebc-ba93-80a147b31121',
  'RODRIGO FERNANDO SCHOELER SPIER',
  'rodrigo.spier.jus@gmail.com',
  '54999001182',
  NULL,
  'socio'
)
ON CONFLICT (user_id) DO NOTHING;

-- Restore his role as owner (sócio)
INSERT INTO public.user_roles (user_id, role)
VALUES ('e97f4526-2a4a-4333-84fe-a0162c26cc90', 'owner')
ON CONFLICT (user_id, role) DO NOTHING;
