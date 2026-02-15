
-- Tabela para armazenar notas de expediente/publicações dos DJEs
CREATE TABLE public.dje_publications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  case_id UUID REFERENCES public.cases(id),
  oab_number TEXT NOT NULL,
  source TEXT NOT NULL, -- 'TRF4', 'TJRS', etc.
  publication_date DATE NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  publication_type TEXT, -- 'Despacho', 'Decisão', 'Sentença', etc.
  process_number TEXT,
  organ TEXT, -- Órgão/vara
  edition TEXT, -- Número da edição
  external_url TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  unique_hash TEXT NOT NULL UNIQUE -- Evitar duplicatas
);

-- Índices
CREATE INDEX idx_dje_publications_tenant ON public.dje_publications(tenant_id);
CREATE INDEX idx_dje_publications_oab ON public.dje_publications(oab_number);
CREATE INDEX idx_dje_publications_date ON public.dje_publications(publication_date DESC);
CREATE INDEX idx_dje_publications_case ON public.dje_publications(case_id);

-- RLS
ALTER TABLE public.dje_publications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view tenant publications"
ON public.dje_publications FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid())
);

CREATE POLICY "Staff update tenant publications"
ON public.dje_publications FOR UPDATE
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'staff'))
);

CREATE POLICY "System insert publications"
ON public.dje_publications FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'staff'))
);

CREATE POLICY "Superadmin view all publications"
ON public.dje_publications FOR SELECT
USING (is_superadmin(auth.uid()));
