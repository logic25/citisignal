
-- ============================================
-- 1. Expand policy types and add enrichment columns to tenant_insurance_policies
-- ============================================

-- AI Review tracking
ALTER TABLE public.tenant_insurance_policies 
  ADD COLUMN IF NOT EXISTS ai_review_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_review_notes text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_reviewed_at timestamptz DEFAULT NULL;

-- Renewal workflow
ALTER TABLE public.tenant_insurance_policies
  ADD COLUMN IF NOT EXISTS renewal_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS renewal_requested_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS renewal_reminder_sent_at timestamptz DEFAULT NULL;

-- Additional coverage details  
ALTER TABLE public.tenant_insurance_policies
  ADD COLUMN IF NOT EXISTS deductible numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS endorsements text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS additional_insured_entity_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS aggregate_limit numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS per_occurrence_limit numeric DEFAULT NULL;

-- ============================================
-- 2. Create building_insurance_policies for owner/building-level policies
-- ============================================

CREATE TABLE IF NOT EXISTS public.building_insurance_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  
  policy_type text NOT NULL,
  carrier_name text,
  policy_number text,
  
  -- Coverage
  coverage_amount numeric,
  deductible numeric,
  per_occurrence_limit numeric,
  aggregate_limit numeric,
  
  -- Dates
  effective_date date,
  expiration_date date,
  
  -- Details
  premium_annual numeric,
  broker_name text,
  broker_phone text,
  broker_email text,
  endorsements text,
  certificate_url text,
  notes text,
  
  status text NOT NULL DEFAULT 'active',
  
  -- AI Review
  ai_review_status text,
  ai_review_notes text,
  ai_reviewed_at timestamptz,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.building_insurance_policies ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view building insurance for their properties"
  ON public.building_insurance_policies FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert building insurance for their properties"
  ON public.building_insurance_policies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update building insurance for their properties"
  ON public.building_insurance_policies FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete building insurance for their properties"
  ON public.building_insurance_policies FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update timestamp trigger
CREATE TRIGGER update_building_insurance_updated_at
  BEFORE UPDATE ON public.building_insurance_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
