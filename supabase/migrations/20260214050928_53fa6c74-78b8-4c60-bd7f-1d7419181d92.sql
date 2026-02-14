
-- Tabela de transações financeiras
CREATE TABLE public.financial_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  case_id UUID REFERENCES public.cases(id),
  type TEXT NOT NULL CHECK (type IN ('revenue', 'expense')),
  category TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  recurrence TEXT DEFAULT NULL CHECK (recurrence IN (NULL, 'monthly', 'yearly')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger updated_at
CREATE TRIGGER update_financial_transactions_updated_at
  BEFORE UPDATE ON public.financial_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Enable RLS
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Staff view tenant financial transactions"
  ON public.financial_transactions FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'staff')));

CREATE POLICY "Staff insert financial transactions"
  ON public.financial_transactions FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'staff')));

CREATE POLICY "Staff update financial transactions"
  ON public.financial_transactions FOR UPDATE
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'staff')));

CREATE POLICY "Owner delete financial transactions"
  ON public.financial_transactions FOR DELETE
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'owner'));
