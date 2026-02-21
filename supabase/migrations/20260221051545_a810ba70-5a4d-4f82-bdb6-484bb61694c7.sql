
-- Create organizations table
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code_id UUID REFERENCES public.invite_codes(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Add organization_id to profiles FIRST (before policies reference it)
ALTER TABLE public.profiles
  ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Add org_role to profiles (owner vs member)
ALTER TABLE public.profiles
  ADD COLUMN org_role TEXT DEFAULT 'member';

-- Add org_name to invite_codes
ALTER TABLE public.invite_codes
  ADD COLUMN org_name TEXT;

-- Now create org policies that reference profiles.organization_id
CREATE POLICY "Users can view their own organization"
  ON public.organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.organization_id = organizations.id
        AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert organizations"
  ON public.organizations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update organizations"
  ON public.organizations FOR UPDATE
  USING (true);

-- Helper function: check if a given user_id is in the same org as auth.uid()
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p1
    JOIN profiles p2 ON p1.organization_id = p2.organization_id
    WHERE p1.user_id = auth.uid()
      AND p2.user_id = _user_id
      AND p1.organization_id IS NOT NULL
  )
$$;

-- Update properties SELECT policy
DROP POLICY IF EXISTS "Users can view their own properties" ON public.properties;
CREATE POLICY "Users can view their own properties"
  ON public.properties FOR SELECT
  USING (
    auth.uid() = user_id
    OR is_property_member(id)
    OR is_org_member(user_id)
  );

-- Update violations SELECT policy
DROP POLICY IF EXISTS "Users can view violations for their properties" ON public.violations;
CREATE POLICY "Users can view violations for their properties"
  ON public.violations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = violations.property_id
        AND (properties.user_id = auth.uid() OR is_property_member(properties.id) OR is_org_member(properties.user_id))
    )
  );

-- Update applications SELECT policy
DROP POLICY IF EXISTS "Users can view applications for their properties" ON public.applications;
CREATE POLICY "Users can view applications for their properties"
  ON public.applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = applications.property_id
        AND (properties.user_id = auth.uid() OR is_property_member(properties.id) OR is_org_member(properties.user_id))
    )
  );

-- Update compliance_requirements SELECT policy
DROP POLICY IF EXISTS "Users can view compliance for their properties" ON public.compliance_requirements;
CREATE POLICY "Users can view compliance for their properties"
  ON public.compliance_requirements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = compliance_requirements.property_id
        AND (properties.user_id = auth.uid() OR is_property_member(properties.id) OR is_org_member(properties.user_id))
    )
  );

-- Update compliance_scores SELECT policy
DROP POLICY IF EXISTS "Users can view their own compliance scores" ON public.compliance_scores;
CREATE POLICY "Users can view their own compliance scores"
  ON public.compliance_scores FOR SELECT
  USING (
    auth.uid() = user_id
    OR is_property_member(property_id)
    OR is_org_member(user_id)
  );

-- Update property_documents SELECT policy
DROP POLICY IF EXISTS "Users can view documents for their properties" ON public.property_documents;
CREATE POLICY "Users can view documents for their properties"
  ON public.property_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_documents.property_id
        AND (properties.user_id = auth.uid() OR is_property_member(properties.id) OR is_org_member(properties.user_id))
    )
  );

-- Update property_activity_log SELECT policy
DROP POLICY IF EXISTS "Users can view activity for their properties" ON public.property_activity_log;
CREATE POLICY "Users can view activity for their properties"
  ON public.property_activity_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_activity_log.property_id
        AND (properties.user_id = auth.uid() OR is_property_member(properties.id) OR is_org_member(properties.user_id))
    )
  );

-- Update work_orders SELECT policy
DROP POLICY IF EXISTS "Users can view work orders for their properties" ON public.work_orders;
CREATE POLICY "Users can view work orders for their properties"
  ON public.work_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = work_orders.property_id
        AND (properties.user_id = auth.uid() OR is_property_member(properties.id) OR is_org_member(properties.user_id))
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
