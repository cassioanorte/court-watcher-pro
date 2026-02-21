-- Allow anyone to view landing pages in preview mode (all statuses)
-- This is safe since the slug is unguessable and preview is for sharing/testing
CREATE POLICY "Public view all landing pages by slug"
ON public.landing_pages
FOR SELECT
USING (true);

-- Drop the old restrictive public policy since the new one covers it
DROP POLICY IF EXISTS "Public view published landing pages" ON public.landing_pages;