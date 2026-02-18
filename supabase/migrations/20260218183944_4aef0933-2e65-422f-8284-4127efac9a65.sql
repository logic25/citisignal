
-- Create function to get next PO number (used by edge function)
CREATE OR REPLACE FUNCTION public.nextval_po_number()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT nextval('po_number_seq');
$$;
