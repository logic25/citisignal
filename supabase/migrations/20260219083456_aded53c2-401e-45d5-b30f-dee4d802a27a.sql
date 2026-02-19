-- Allow admins to delete any feature request
CREATE POLICY "Admins can delete feature requests"
ON public.feature_requests
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update any feature request (status changes)
DROP POLICY IF EXISTS "Authenticated users can upvote" ON public.feature_requests;
CREATE POLICY "Authenticated users or admins can update feature requests"
ON public.feature_requests
FOR UPDATE
USING (auth.uid() IS NOT NULL);
