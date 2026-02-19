
-- Remove the overly permissive service role policy (edge function uses service_role key which bypasses RLS)
DROP POLICY IF EXISTS "Service role can update use_count" ON public.invite_codes;
