
-- Step 1: Make property_members.user_id nullable so pending invites don't need a user yet
ALTER TABLE public.property_members ALTER COLUMN user_id DROP NOT NULL;

-- Step 2: Create helper function to check if current user is an accepted member of a property
CREATE OR REPLACE FUNCTION public.is_property_member(_property_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM property_members
    WHERE property_id = _property_id
      AND user_id = auth.uid()
      AND status = 'accepted'
  )
$$;

-- Step 3: Update properties SELECT policy to include members
DROP POLICY IF EXISTS "Users can view their own properties" ON public.properties;
CREATE POLICY "Users can view their own properties" ON public.properties
  FOR SELECT USING (auth.uid() = user_id OR is_property_member(id));

-- Step 4: Update violations SELECT policy
DROP POLICY IF EXISTS "Users can view violations for their properties" ON public.violations;
CREATE POLICY "Users can view violations for their properties" ON public.violations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = violations.property_id
        AND (properties.user_id = auth.uid() OR is_property_member(properties.id))
    )
  );

-- Step 5: Update applications SELECT policy
DROP POLICY IF EXISTS "Users can view applications for their properties" ON public.applications;
CREATE POLICY "Users can view applications for their properties" ON public.applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = applications.property_id
        AND (properties.user_id = auth.uid() OR is_property_member(properties.id))
    )
  );

-- Step 6: Update compliance_requirements SELECT policy
DROP POLICY IF EXISTS "Users can view compliance for their properties" ON public.compliance_requirements;
CREATE POLICY "Users can view compliance for their properties" ON public.compliance_requirements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = compliance_requirements.property_id
        AND (properties.user_id = auth.uid() OR is_property_member(properties.id))
    )
  );

-- Step 7: Update compliance_scores SELECT policy
DROP POLICY IF EXISTS "Users can view their own compliance scores" ON public.compliance_scores;
CREATE POLICY "Users can view their own compliance scores" ON public.compliance_scores
  FOR SELECT USING (
    auth.uid() = user_id OR is_property_member(property_id)
  );

-- Step 8: Update property_documents SELECT policy
DROP POLICY IF EXISTS "Users can view documents for their properties" ON public.property_documents;
CREATE POLICY "Users can view documents for their properties" ON public.property_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_documents.property_id
        AND (properties.user_id = auth.uid() OR is_property_member(properties.id))
    )
  );

-- Step 9: Update property_activity_log SELECT policy
DROP POLICY IF EXISTS "Users can view activity for their properties" ON public.property_activity_log;
CREATE POLICY "Users can view activity for their properties" ON public.property_activity_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_activity_log.property_id
        AND (properties.user_id = auth.uid() OR is_property_member(properties.id))
    )
  );

-- Step 10: Update work_orders SELECT policy (if exists)
DROP POLICY IF EXISTS "Users can view work orders for their properties" ON public.work_orders;
CREATE POLICY "Users can view work orders for their properties" ON public.work_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = work_orders.property_id
        AND (properties.user_id = auth.uid() OR is_property_member(properties.id))
    )
  );

-- Step 11: Grant property members ability to view property_members for their properties
DROP POLICY IF EXISTS "Users can view members of their properties" ON public.property_members;
CREATE POLICY "Users can view members of their properties" ON public.property_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_members.property_id
        AND (properties.user_id = auth.uid() OR is_property_member(properties.id))
    )
  );

-- Step 12: Allow property owners to insert/update/delete members
DROP POLICY IF EXISTS "Property owners can manage members" ON public.property_members;
CREATE POLICY "Property owners can manage members" ON public.property_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_members.property_id
        AND properties.user_id = auth.uid()
    )
  );

-- Step 13: Allow users to update their own membership (for self-accept)
DROP POLICY IF EXISTS "Users can update their own membership" ON public.property_members;
CREATE POLICY "Users can update their own membership" ON public.property_members
  FOR UPDATE USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
