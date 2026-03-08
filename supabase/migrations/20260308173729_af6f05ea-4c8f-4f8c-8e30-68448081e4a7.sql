ALTER TABLE public.tenant_insurance_policies 
ADD COLUMN IF NOT EXISTS policy_document_url text;

ALTER TABLE public.building_insurance_policies 
ADD COLUMN IF NOT EXISTS policy_document_url text;