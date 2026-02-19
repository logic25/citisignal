
-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view feature requests" ON public.feature_requests;

-- Replace with owner-only SELECT
CREATE POLICY "Users can view their own feature requests"
ON public.feature_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Allow admins to view all feature requests
CREATE POLICY "Admins can view all feature requests"
ON public.feature_requests
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Drop the overly permissive UPDATE policy
DROP POLICY IF EXISTS "Authenticated users or admins can update feature requests" ON public.feature_requests;

-- Only admins can update feature requests (status changes)
CREATE POLICY "Admins can update feature requests"
ON public.feature_requests
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can update their own feature requests (for upvotes on own requests)
CREATE POLICY "Users can update their own feature requests"
ON public.feature_requests
FOR UPDATE
USING (auth.uid() = user_id);
