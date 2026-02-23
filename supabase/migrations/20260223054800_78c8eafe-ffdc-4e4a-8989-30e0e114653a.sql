
-- Table to track eproc sync sessions
CREATE TABLE public.eproc_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  source TEXT NOT NULL, -- TJRS_1G, TJRS_2G, TRF4_JFRS, etc.
  processes_found INTEGER DEFAULT 0,
  processes_synced INTEGER DEFAULT 0,
  movements_synced INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'syncing', -- syncing, completed, failed
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.eproc_sync_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own tenant sync logs"
  ON public.eproc_sync_logs FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "Users can insert sync logs for own tenant"
  ON public.eproc_sync_logs FOR INSERT
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "Users can update own tenant sync logs"
  ON public.eproc_sync_logs FOR UPDATE
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

-- Index
CREATE INDEX idx_eproc_sync_logs_tenant ON public.eproc_sync_logs(tenant_id, created_at DESC);
