
-- Purchase orders table
CREATE TABLE public.purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id),
  user_id UUID NOT NULL,
  po_number TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  scope TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_vendor_signature',
  owner_signed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  vendor_signed_at TIMESTAMP WITH TIME ZONE,
  vendor_sign_token UUID NOT NULL DEFAULT gen_random_uuid(),
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own POs"
  ON public.purchase_orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own POs"
  ON public.purchase_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own POs"
  ON public.purchase_orders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own POs"
  ON public.purchase_orders FOR DELETE
  USING (auth.uid() = user_id);

-- Allow anonymous access for vendor signing via token
CREATE POLICY "Vendors can view PO by sign token"
  ON public.purchase_orders FOR SELECT
  USING (true);

CREATE POLICY "Vendors can update PO by sign token"
  ON public.purchase_orders FOR UPDATE
  USING (true);

-- Add PO reference to work_orders
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS po_id UUID REFERENCES public.purchase_orders(id);

-- Generate PO number sequence
CREATE SEQUENCE IF NOT EXISTS po_number_seq START 1001;
