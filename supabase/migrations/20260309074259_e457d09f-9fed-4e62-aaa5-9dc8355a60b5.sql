
-- Secure account linking table (replaces Base64 user ID encoding)
CREATE TABLE public.pending_account_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  channel text NOT NULL CHECK (channel IN ('telegram', 'whatsapp')),
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.pending_account_links ENABLE ROW LEVEL SECURITY;

-- Users can create their own link tokens
CREATE POLICY "Users can insert own link tokens"
  ON public.pending_account_links FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own tokens
CREATE POLICY "Users can read own link tokens"
  ON public.pending_account_links FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Index for token lookup (used by edge functions with service role)
CREATE INDEX idx_pending_account_links_token ON pending_account_links(token) WHERE used = false;

-- Clean up expired tokens periodically
CREATE INDEX idx_pending_account_links_expires ON pending_account_links(expires_at) WHERE used = false;
