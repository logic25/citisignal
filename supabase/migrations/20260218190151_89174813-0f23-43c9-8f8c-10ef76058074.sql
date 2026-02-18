
-- Add default PO terms to profiles (global setting per user)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS po_terms_and_conditions text;

-- Add terms to purchase_orders (per-PO override)
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS terms_and_conditions text;
