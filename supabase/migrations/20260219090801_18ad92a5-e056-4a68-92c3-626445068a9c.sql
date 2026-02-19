
-- Create bug_reports table for beta tester feedback
CREATE TABLE public.bug_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  page_url TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- Users can create their own bug reports
CREATE POLICY "Users can insert their own bug reports"
ON public.bug_reports FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own bug reports
CREATE POLICY "Users can view their own bug reports"
ON public.bug_reports FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all bug reports
CREATE POLICY "Admins can view all bug reports"
ON public.bug_reports FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Admins can update bug reports (status, admin_notes)
CREATE POLICY "Admins can update bug reports"
ON public.bug_reports FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_bug_reports_updated_at
BEFORE UPDATE ON public.bug_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
