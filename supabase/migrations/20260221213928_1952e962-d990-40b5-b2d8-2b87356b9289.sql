
ALTER TABLE public.payment_orders 
ADD COLUMN IF NOT EXISTS ownership_type text NOT NULL DEFAULT 'cliente',
ADD COLUMN IF NOT EXISTS fee_type text NOT NULL DEFAULT 'contratuais',
ADD COLUMN IF NOT EXISTS tax_percent numeric DEFAULT 10.9;

COMMENT ON COLUMN public.payment_orders.ownership_type IS 'cliente = do cliente com desconto de honorários, escritorio = destacado 100% do escritório';
COMMENT ON COLUMN public.payment_orders.fee_type IS 'contratuais ou sucumbenciais';
COMMENT ON COLUMN public.payment_orders.tax_percent IS 'Percentual de imposto aplicável';
