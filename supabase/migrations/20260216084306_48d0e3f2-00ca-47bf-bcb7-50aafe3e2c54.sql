
-- Add parties column to cases table
ALTER TABLE public.cases ADD COLUMN parties text NULL;

-- Migrate existing case_summary data to parties (only where it looks like "Author | Defendant" pattern)
UPDATE public.cases
SET parties = case_summary,
    case_summary = NULL
WHERE case_summary IS NOT NULL
  AND case_summary LIKE '%|%';
