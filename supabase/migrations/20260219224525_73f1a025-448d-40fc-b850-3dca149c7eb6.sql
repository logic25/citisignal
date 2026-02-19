
-- Create invite_codes table
CREATE TABLE public.invite_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  max_uses integer NOT NULL DEFAULT 1,
  use_count integer NOT NULL DEFAULT 0,
  expires_at timestamp with time zone NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

-- Only admins can view invite codes
CREATE POLICY "Admins can view invite codes"
  ON public.invite_codes
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Only admins can insert invite codes
CREATE POLICY "Admins can create invite codes"
  ON public.invite_codes
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update invite codes
CREATE POLICY "Admins can update invite codes"
  ON public.invite_codes
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete invite codes
CREATE POLICY "Admins can delete invite codes"
  ON public.invite_codes
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Updated_at trigger
CREATE TRIGGER update_invite_codes_updated_at
  BEFORE UPDATE ON public.invite_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Service role can update use_count (used by edge function with service role)
CREATE POLICY "Service role can update use_count"
  ON public.invite_codes
  FOR UPDATE
  USING (true)
  WITH CHECK (true);
