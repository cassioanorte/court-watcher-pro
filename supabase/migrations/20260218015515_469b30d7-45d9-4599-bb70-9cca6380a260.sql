
-- Add AI credit columns to tenants
ALTER TABLE public.tenants
ADD COLUMN ai_credits_limit integer NOT NULL DEFAULT 0,
ADD COLUMN ai_credits_used integer NOT NULL DEFAULT 0,
ADD COLUMN ai_credits_reset_at timestamp with time zone DEFAULT now();

-- Add AI analysis columns to dje_publications
ALTER TABLE public.dje_publications
ADD COLUMN ai_summary text,
ADD COLUMN ai_deadlines text,
ADD COLUMN ai_next_steps text,
ADD COLUMN ai_analyzed_at timestamp with time zone;
