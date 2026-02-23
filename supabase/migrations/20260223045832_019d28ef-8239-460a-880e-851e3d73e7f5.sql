
-- Create the update_updated_at_column function first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create case_fulfillments table
CREATE TABLE public.case_fulfillments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  category TEXT NOT NULL,
  description TEXT,
  assigned_to UUID NOT NULL,
  assigned_by UUID NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  completed_at TIMESTAMPTZ,
  source_type TEXT,
  source_id UUID,
  priority TEXT NOT NULL DEFAULT 'normal',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.case_fulfillments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view fulfillments in their tenant"
  ON public.case_fulfillments FOR SELECT
  USING (tenant_id IN (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "Users can create fulfillments in their tenant"
  ON public.case_fulfillments FOR INSERT
  WITH CHECK (tenant_id IN (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "Users can update fulfillments in their tenant"
  ON public.case_fulfillments FOR UPDATE
  USING (tenant_id IN (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "Users can delete fulfillments in their tenant"
  ON public.case_fulfillments FOR DELETE
  USING (tenant_id IN (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_case_fulfillments_updated_at
  BEFORE UPDATE ON public.case_fulfillments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create notification + reminder when fulfillment is assigned
CREATE OR REPLACE FUNCTION public.notify_fulfillment_assigned()
RETURNS TRIGGER AS $$
DECLARE
  _process_number TEXT;
  _category_label TEXT;
BEGIN
  SELECT process_number INTO _process_number FROM public.cases WHERE id = NEW.case_id;
  
  _category_label := CASE NEW.category
    WHEN 'peticao' THEN 'Petição'
    WHEN 'recurso' THEN 'Recurso'
    WHEN 'cumprimento_despacho' THEN 'Cumprimento de Despacho'
    WHEN 'audiencia_diligencia' THEN 'Audiência/Diligência'
    WHEN 'contato_cliente' THEN 'Ligar para o Cliente'
    WHEN 'solicitar_documentacao' THEN 'Solicitar Documentação'
    WHEN 'manifestacao' THEN 'Manifestação'
    WHEN 'alvara' THEN 'Alvará'
    WHEN 'calculo' THEN 'Cálculo'
    WHEN 'providencia_administrativa' THEN 'Providência Administrativa'
    ELSE NEW.category
  END;

  INSERT INTO public.notifications (user_id, title, body, case_id)
  VALUES (
    NEW.assigned_to,
    'Novo Cumprimento: ' || _category_label,
    'Processo ' || COALESCE(_process_number, 'N/A') || ' — Prazo: ' || TO_CHAR(NEW.due_date, 'DD/MM/YYYY'),
    NEW.case_id
  );

  INSERT INTO public.reminders (assigned_to, created_by, tenant_id, title, description, due_date, category, case_id)
  VALUES (
    NEW.assigned_to,
    NEW.assigned_by,
    NEW.tenant_id,
    _category_label || ' — ' || COALESCE(_process_number, 'Processo'),
    NEW.description,
    NEW.due_date,
    'cumprimento',
    NEW.case_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_fulfillment_assigned
  AFTER INSERT ON public.case_fulfillments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_fulfillment_assigned();

ALTER PUBLICATION supabase_realtime ADD TABLE public.case_fulfillments;
