CREATE TABLE public.system_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Only superadmins can read/write
CREATE POLICY "Superadmin read system_config"
  ON public.system_config FOR SELECT
  USING (is_superadmin(auth.uid()));

CREATE POLICY "Superadmin insert system_config"
  ON public.system_config FOR INSERT
  WITH CHECK (is_superadmin(auth.uid()));

CREATE POLICY "Superadmin update system_config"
  ON public.system_config FOR UPDATE
  USING (is_superadmin(auth.uid()));

-- Seed default value
INSERT INTO public.system_config (key, value) VALUES
  ('ai_credits_pool', '{"dollars_loaded": 0, "credits_per_dollar": 100}'::jsonb)
ON CONFLICT (key) DO NOTHING;