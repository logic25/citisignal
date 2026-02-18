
-- Add new status values to work_order_status enum
ALTER TYPE work_order_status ADD VALUE IF NOT EXISTS 'dispatched' AFTER 'open';
ALTER TYPE work_order_status ADD VALUE IF NOT EXISTS 'quoted' AFTER 'dispatched';
ALTER TYPE work_order_status ADD VALUE IF NOT EXISTS 'approved' AFTER 'quoted';

-- Add new columns to work_orders
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS quoted_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS approved_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vendor_notified_via TEXT;

-- Create work_order_messages table for communication threads
CREATE TABLE public.work_order_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL DEFAULT 'system',
  sender_name TEXT,
  channel TEXT NOT NULL DEFAULT 'in_app',
  message TEXT NOT NULL,
  extracted_amount NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.work_order_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies: same property-based pattern as work_orders
CREATE POLICY "Users can view messages for their work orders"
  ON public.work_order_messages
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM work_orders wo
    JOIN properties p ON p.id = wo.property_id
    WHERE wo.id = work_order_messages.work_order_id
    AND p.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert messages for their work orders"
  ON public.work_order_messages
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM work_orders wo
    JOIN properties p ON p.id = wo.property_id
    WHERE wo.id = work_order_messages.work_order_id
    AND p.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete messages for their work orders"
  ON public.work_order_messages
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM work_orders wo
    JOIN properties p ON p.id = wo.property_id
    WHERE wo.id = work_order_messages.work_order_id
    AND p.user_id = auth.uid()
  ));

-- Service role needs insert access for webhook-created messages
CREATE POLICY "Service role can insert work order messages"
  ON public.work_order_messages
  FOR INSERT
  WITH CHECK (true);

-- Service role needs select for webhook lookups
CREATE POLICY "Service role can view work order messages"
  ON public.work_order_messages
  FOR SELECT
  USING (true);
