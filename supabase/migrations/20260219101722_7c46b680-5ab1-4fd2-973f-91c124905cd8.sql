-- Drop the overly permissive vendor policies on purchase_orders
DROP POLICY IF EXISTS "Vendors can view PO by sign token" ON public.purchase_orders;
DROP POLICY IF EXISTS "Vendors can update PO by sign token" ON public.purchase_orders;