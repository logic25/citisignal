
-- Roadmap items table (admin-managed, publicly readable)
CREATE TABLE public.roadmap_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phase TEXT NOT NULL DEFAULT 'planned',
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.roadmap_items ENABLE ROW LEVEL SECURITY;

-- Anyone can read roadmap (it's public-facing)
CREATE POLICY "Roadmap items are publicly readable"
ON public.roadmap_items FOR SELECT
USING (true);

-- Only admins can manage
CREATE POLICY "Admins can insert roadmap items"
ON public.roadmap_items FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update roadmap items"
ON public.roadmap_items FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete roadmap items"
ON public.roadmap_items FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Feature requests table
CREATE TABLE public.feature_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'submitted',
  upvotes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_requests ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view feature requests
CREATE POLICY "Authenticated users can view feature requests"
ON public.feature_requests FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Users can create their own requests
CREATE POLICY "Users can create feature requests"
ON public.feature_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own requests (for upvoting, all authenticated can update)
CREATE POLICY "Authenticated users can upvote"
ON public.feature_requests FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Users can delete their own requests
CREATE POLICY "Users can delete own feature requests"
ON public.feature_requests FOR DELETE
USING (auth.uid() = user_id);

-- Seed roadmap with current data
INSERT INTO public.roadmap_items (phase, title, sort_order) VALUES
('live', 'Core property intelligence & violation tracking', 1),
('live', 'DOB, ECB, HPD, FDNY, DOT, DSNY agency sync', 2),
('live', 'SMS & Telegram violation alerts', 3),
('live', 'Compliance scoring (A–F grading)', 4),
('live', 'Lease Q&A with AI document analysis', 5),
('live', 'Work order & vendor management', 6),
('live', 'Certificate of Occupancy detection', 7),
('in_progress', 'WhatsApp bot integration', 1),
('in_progress', 'OATH hearing & penalty sync', 2),
('in_progress', 'Stop Work Order / Vacate detection refinement', 3),
('in_progress', 'TCO expiration critical alerts', 4),
('next_up', 'QuickBooks financial sync', 1),
('next_up', 'Help Center & feature requests', 2),
('next_up', 'CO tracking enhancements', 3),
('next_up', 'OER tracking (E-designations)', 4),
('future', 'Portfolio-level analytics dashboards', 1),
('future', 'Google Calendar sync for deadlines', 2),
('future', 'White-label / multi-tenant support', 3),
('future', 'Enhanced RAG for document Q&A', 4);

-- Trigger for updated_at
CREATE TRIGGER update_roadmap_items_updated_at
BEFORE UPDATE ON public.roadmap_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_feature_requests_updated_at
BEFORE UPDATE ON public.feature_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
