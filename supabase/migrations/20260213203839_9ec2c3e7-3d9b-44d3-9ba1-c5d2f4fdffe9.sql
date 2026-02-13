
-- Create storage bucket for case documents
INSERT INTO storage.buckets (id, name, public) VALUES ('case-documents', 'case-documents', true);

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users upload documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'case-documents');

-- Allow authenticated users to view files
CREATE POLICY "Authenticated users view documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'case-documents');

-- Allow authenticated users to delete their own files
CREATE POLICY "Authenticated users delete documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'case-documents');
