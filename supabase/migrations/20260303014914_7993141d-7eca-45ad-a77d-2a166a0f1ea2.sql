-- Allow admins to view any property (for "View as User" feature)
DROP POLICY IF EXISTS "Users can view their own properties" ON public.properties;

CREATE POLICY "Users can view their own properties"
ON public.properties
FOR SELECT
USING (
  auth.uid() = user_id
  OR is_property_member(id)
  OR is_org_member(user_id)
  OR public.has_role(auth.uid(), 'admin')
);

-- Allow admins to view any violations (for admin user detail)
DROP POLICY IF EXISTS "Users can view their own violations" ON public.violations;

CREATE POLICY "Users can view their own violations"
ON public.violations
FOR SELECT
USING (
  property_id IN (SELECT id FROM public.properties WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

-- Allow admins to view any tenants
DROP POLICY IF EXISTS "Users can view their own tenants" ON public.tenants;

CREATE POLICY "Users can view their own tenants"
ON public.tenants
FOR SELECT
USING (
  property_id IN (SELECT id FROM public.properties WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

-- Allow admins to view any work orders
DROP POLICY IF EXISTS "Users can view their own work orders" ON public.work_orders;

CREATE POLICY "Users can view their own work orders"
ON public.work_orders
FOR SELECT
USING (
  property_id IN (SELECT id FROM public.properties WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

-- Allow admins to view any property documents
DROP POLICY IF EXISTS "Users can view their own documents" ON public.property_documents;

CREATE POLICY "Users can view their own documents"
ON public.property_documents
FOR SELECT
USING (
  property_id IN (SELECT id FROM public.properties WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

-- Allow admins to view any compliance requirements
DROP POLICY IF EXISTS "Users can view their own compliance" ON public.compliance_requirements;

CREATE POLICY "Users can view their own compliance"
ON public.compliance_requirements
FOR SELECT
USING (
  property_id IN (SELECT id FROM public.properties WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

-- Allow admins to view any applications
DROP POLICY IF EXISTS "Users can view their own applications" ON public.applications;

CREATE POLICY "Users can view their own applications"
ON public.applications
FOR SELECT
USING (
  property_id IN (SELECT id FROM public.properties WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);