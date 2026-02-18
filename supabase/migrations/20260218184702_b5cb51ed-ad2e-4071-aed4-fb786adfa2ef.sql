
-- Add completion and payment columns to work_orders
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS completion_photos jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS completion_notes text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- Add payment info to vendors
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS zelle_email text,
  ADD COLUMN IF NOT EXISTS zelle_phone text,
  ADD COLUMN IF NOT EXISTS payment_preference text DEFAULT 'zelle';

-- Create work-order-photos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('work-order-photos', 'work-order-photos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for work-order-photos bucket
CREATE POLICY "Authenticated users can upload work order photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'work-order-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view work order photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'work-order-photos');

CREATE POLICY "Users can delete their own work order photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'work-order-photos' AND auth.role() = 'authenticated');
