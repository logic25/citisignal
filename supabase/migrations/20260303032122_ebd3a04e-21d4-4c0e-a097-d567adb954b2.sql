
-- Add website and mobile_number to vendors
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS mobile_number text;

-- Create vendor_contacts table
CREATE TABLE public.vendor_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  role text,
  phone text,
  mobile text,
  email text,
  notes text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view contacts for their vendors"
  ON public.vendor_contacts FOR SELECT
  USING (EXISTS (SELECT 1 FROM vendors WHERE vendors.id = vendor_contacts.vendor_id AND vendors.user_id = auth.uid()));

CREATE POLICY "Users can insert contacts for their vendors"
  ON public.vendor_contacts FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM vendors WHERE vendors.id = vendor_contacts.vendor_id AND vendors.user_id = auth.uid()));

CREATE POLICY "Users can update contacts for their vendors"
  ON public.vendor_contacts FOR UPDATE
  USING (EXISTS (SELECT 1 FROM vendors WHERE vendors.id = vendor_contacts.vendor_id AND vendors.user_id = auth.uid()));

CREATE POLICY "Users can delete contacts for their vendors"
  ON public.vendor_contacts FOR DELETE
  USING (EXISTS (SELECT 1 FROM vendors WHERE vendors.id = vendor_contacts.vendor_id AND vendors.user_id = auth.uid()));

-- Create telegram_messages table to store chat history
CREATE TABLE public.telegram_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id bigint NOT NULL,
  user_id uuid,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  direction text NOT NULL DEFAULT 'inbound',
  message_text text,
  telegram_message_id bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their telegram messages"
  ON public.telegram_messages FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM vendors WHERE vendors.id = telegram_messages.vendor_id AND vendors.user_id = auth.uid()
  ));

CREATE POLICY "Service role can insert telegram messages"
  ON public.telegram_messages FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_telegram_messages_chat_id ON public.telegram_messages(chat_id);
CREATE INDEX idx_telegram_messages_vendor_id ON public.telegram_messages(vendor_id);
CREATE INDEX idx_vendor_contacts_vendor_id ON public.vendor_contacts(vendor_id);
