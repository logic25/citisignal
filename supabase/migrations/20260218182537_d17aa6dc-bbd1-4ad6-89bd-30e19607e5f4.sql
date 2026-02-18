-- Add more vendor profile fields
ALTER TABLE public.vendors 
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS license_number text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS avg_rating numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_reviews integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_spent numeric DEFAULT 0;

-- Create vendor_reviews table
CREATE TABLE public.vendor_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title text,
  review_text text,
  quality_rating integer CHECK (quality_rating >= 1 AND quality_rating <= 5),
  timeliness_rating integer CHECK (timeliness_rating >= 1 AND timeliness_rating <= 5),
  communication_rating integer CHECK (communication_rating >= 1 AND communication_rating <= 5),
  value_rating integer CHECK (value_rating >= 1 AND value_rating <= 5),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vendor_reviews ENABLE ROW LEVEL SECURITY;

-- Policies: users can CRUD their own reviews
CREATE POLICY "Users can view reviews for their vendors"
  ON public.vendor_reviews FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM vendors WHERE vendors.id = vendor_reviews.vendor_id AND vendors.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert reviews for their vendors"
  ON public.vendor_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM vendors WHERE vendors.id = vendor_reviews.vendor_id AND vendors.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own reviews"
  ON public.vendor_reviews FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews"
  ON public.vendor_reviews FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to update avg_rating on vendor when reviews change
CREATE OR REPLACE FUNCTION public.update_vendor_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE vendors SET
    avg_rating = COALESCE((SELECT AVG(rating) FROM vendor_reviews WHERE vendor_id = COALESCE(NEW.vendor_id, OLD.vendor_id)), 0),
    total_reviews = COALESCE((SELECT COUNT(*) FROM vendor_reviews WHERE vendor_id = COALESCE(NEW.vendor_id, OLD.vendor_id)), 0),
    updated_at = now()
  WHERE id = COALESCE(NEW.vendor_id, OLD.vendor_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_vendor_rating_on_review
  AFTER INSERT OR UPDATE OR DELETE ON public.vendor_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_vendor_rating();
