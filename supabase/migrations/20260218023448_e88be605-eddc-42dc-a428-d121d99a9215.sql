-- Add archived column to cases
ALTER TABLE public.cases ADD COLUMN archived boolean NOT NULL DEFAULT false;

-- Index for fast filtering
CREATE INDEX idx_cases_archived ON public.cases (tenant_id, archived);
