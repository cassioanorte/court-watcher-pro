
-- Create payment_orders table for RPV/Precatório tracking
CREATE TABLE public.payment_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  case_id UUID REFERENCES public.cases(id),
  created_by UUID NOT NULL,
  
  -- Type and status
  type TEXT NOT NULL DEFAULT 'rpv', -- rpv, precatorio
  status TEXT NOT NULL DEFAULT 'aguardando', -- aguardando, liberado, sacado, cancelado
  
  -- Financial data
  gross_amount NUMERIC DEFAULT 0,          -- Valor bruto total
  office_fees_percent NUMERIC DEFAULT 0,   -- % honorários
  office_amount NUMERIC DEFAULT 0,         -- Valor do escritório
  client_amount NUMERIC DEFAULT 0,         -- Valor do cliente
  court_costs NUMERIC DEFAULT 0,           -- Custas judiciais
  social_security NUMERIC DEFAULT 0,       -- Contribuição previdenciária
  income_tax NUMERIC DEFAULT 0,            -- Imposto de renda retido
  
  -- Document info
  document_url TEXT,
  document_name TEXT,
  
  -- Extracted metadata
  beneficiary_name TEXT,
  beneficiary_cpf TEXT,
  process_number TEXT,
  court TEXT,                              -- Vara/Tribunal
  entity TEXT,                             -- Entidade devedora (INSS, União, etc.)
  reference_date TEXT,                     -- Data base de cálculo
  expected_payment_date DATE,              -- Previsão de pagamento
  
  -- AI extraction
  ai_extracted BOOLEAN DEFAULT false,
  ai_raw_data JSONB,
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Staff view tenant payment orders"
ON public.payment_orders FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Staff insert payment orders"
ON public.payment_orders FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);

CREATE POLICY "Staff update payment orders"
ON public.payment_orders FOR UPDATE
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);

CREATE POLICY "Staff delete payment orders"
ON public.payment_orders FOR DELETE
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);

-- Client view their own payment orders
CREATE POLICY "Client view own payment orders"
ON public.payment_orders FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_role(auth.uid(), 'client'::app_role)
  AND case_id IN (SELECT id FROM cases WHERE client_user_id = auth.uid())
);

-- Storage bucket for payment documents
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-documents', 'payment-documents', false);

-- Storage policies
CREATE POLICY "Staff upload payment documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'payment-documents'
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);

CREATE POLICY "Staff view payment documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'payment-documents'
);

CREATE POLICY "Staff delete payment documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'payment-documents'
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);
