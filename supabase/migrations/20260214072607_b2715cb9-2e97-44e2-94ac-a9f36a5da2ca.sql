
-- Add subscription and trial fields to tenants
ALTER TABLE public.tenants
ADD COLUMN monthly_fee numeric DEFAULT 0,
ADD COLUMN trial_ends_at timestamp with time zone DEFAULT NULL,
ADD COLUMN trial_duration_days integer DEFAULT NULL,
ADD COLUMN subscription_status text DEFAULT 'active';

-- Create index for subscription status
CREATE INDEX idx_tenants_subscription_status ON public.tenants(subscription_status);
