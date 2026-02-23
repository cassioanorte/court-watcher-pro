
-- Table to store documents discovered by the bookmarklet for selective download
CREATE TABLE public.eproc_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  case_id UUID REFERENCES public.cases(id),
  process_number TEXT NOT NULL,
  sync_log_id UUID REFERENCES public.eproc_sync_logs(id),
  document_name TEXT NOT NULL,
  document_url TEXT NOT NULL,
  document_type TEXT, -- e.g. 'rpv', 'precatorio', 'alvara', 'sentenca', 'other'
  file_size TEXT,
  status TEXT NOT NULL DEFAULT 'discovered', -- discovered, downloading, downloaded, processed, error
  downloaded_at TIMESTAMP WITH TIME ZONE,
  processed_at TIMESTAMP WITH TIME ZONE,
  processing_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  unique_hash TEXT NOT NULL
);

-- Unique constraint to prevent duplicates
ALTER TABLE public.eproc_documents ADD CONSTRAINT eproc_documents_unique_hash_key UNIQUE (unique_hash);

-- Enable RLS
ALTER TABLE public.eproc_documents ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Staff view tenant documents" ON public.eproc_documents
  FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Staff insert tenant documents" ON public.eproc_documents
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Staff update tenant documents" ON public.eproc_documents
  FOR UPDATE USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Staff delete tenant documents" ON public.eproc_documents
  FOR DELETE USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Index for performance
CREATE INDEX idx_eproc_documents_tenant ON public.eproc_documents(tenant_id);
CREATE INDEX idx_eproc_documents_status ON public.eproc_documents(status);
CREATE INDEX idx_eproc_documents_type ON public.eproc_documents(document_type);
