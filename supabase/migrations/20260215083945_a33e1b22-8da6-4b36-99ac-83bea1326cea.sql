
-- Add lead_id to appointments for CRM integration
ALTER TABLE public.appointments ADD COLUMN lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL;

-- Index for faster lookups
CREATE INDEX idx_appointments_lead_id ON public.appointments(lead_id);
