
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS theme_colors jsonb DEFAULT '{}';
