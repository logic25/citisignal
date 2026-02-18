
-- Create tenants table for CRE tenant directory
CREATE TABLE public.tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  unit_number TEXT,
  lease_start DATE,
  lease_end DATE,
  rent_amount NUMERIC,
  escalation_notes TEXT,
  renewal_option_date DATE,
  security_deposit NUMERIC,
  lease_type TEXT DEFAULT 'gross',
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- RLS policies via property ownership
CREATE POLICY "Users can view tenants for their properties"
ON public.tenants FOR SELECT
USING (EXISTS (SELECT 1 FROM properties WHERE properties.id = tenants.property_id AND properties.user_id = auth.uid()));

CREATE POLICY "Users can insert tenants for their properties"
ON public.tenants FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM properties WHERE properties.id = tenants.property_id AND properties.user_id = auth.uid()));

CREATE POLICY "Users can update tenants for their properties"
ON public.tenants FOR UPDATE
USING (EXISTS (SELECT 1 FROM properties WHERE properties.id = tenants.property_id AND properties.user_id = auth.uid()));

CREATE POLICY "Users can delete tenants for their properties"
ON public.tenants FOR DELETE
USING (EXISTS (SELECT 1 FROM properties WHERE properties.id = tenants.property_id AND properties.user_id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_tenants_updated_at
BEFORE UPDATE ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for property lookups
CREATE INDEX idx_tenants_property_id ON public.tenants(property_id);
CREATE INDEX idx_tenants_lease_end ON public.tenants(lease_end);
