
-- Landing pages table
CREATE TABLE public.landing_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  template TEXT NOT NULL DEFAULT 'classic',
  status TEXT NOT NULL DEFAULT 'draft',
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, slug)
);

-- Enable RLS
ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;

-- Staff can view their tenant's landing pages
CREATE POLICY "Staff view tenant landing pages"
ON public.landing_pages FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);

-- Staff can create landing pages
CREATE POLICY "Staff insert landing pages"
ON public.landing_pages FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);

-- Staff can update landing pages
CREATE POLICY "Staff update landing pages"
ON public.landing_pages FOR UPDATE
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);

-- Staff can delete landing pages
CREATE POLICY "Staff delete landing pages"
ON public.landing_pages FOR DELETE
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);

-- Public can view published landing pages (for /lp/:slug route)
CREATE POLICY "Public view published landing pages"
ON public.landing_pages FOR SELECT
USING (status = 'published');

-- Superadmin view all
CREATE POLICY "Superadmin view all landing pages"
ON public.landing_pages FOR SELECT
USING (is_superadmin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_landing_pages_updated_at
BEFORE UPDATE ON public.landing_pages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();
