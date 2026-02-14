
-- Add payment tracking fields to tenants
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS payment_due_date date DEFAULT NULL,
ADD COLUMN IF NOT EXISTS blocked_at timestamp with time zone DEFAULT NULL;

-- Update subscription_status to support new statuses
-- Possible values: active, trial, overdue, blocked, exempt (isento)
COMMENT ON COLUMN public.tenants.subscription_status IS 'active | trial | overdue | blocked | exempt';
COMMENT ON COLUMN public.tenants.payment_status IS 'paid | pending | overdue | exempt';
