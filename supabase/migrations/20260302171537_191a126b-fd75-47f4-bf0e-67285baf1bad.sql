CREATE TABLE IF NOT EXISTS pending_po_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  po_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  confirmation_code text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('telegram', 'sms', 'whatsapp')),
  chat_id text,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false
);

CREATE INDEX idx_pending_po_vendor ON pending_po_confirmations(vendor_id, used, expires_at);

ALTER TABLE pending_po_confirmations ENABLE ROW LEVEL SECURITY;