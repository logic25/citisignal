
-- Add tenant_id to violations for assignment tracking
ALTER TABLE public.violations
ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;

-- Add assigned_at timestamp
ALTER TABLE public.violations
ADD COLUMN tenant_assigned_at timestamp with time zone;

-- Add index for efficient lookups
CREATE INDEX idx_violations_tenant_id ON public.violations(tenant_id) WHERE tenant_id IS NOT NULL;
