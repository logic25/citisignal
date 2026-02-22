
-- WhatsApp users table for linking accounts (mirrors telegram_users pattern)
CREATE TABLE public.whatsapp_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  phone_number TEXT NOT NULL,
  display_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  linked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint on phone number (one WhatsApp account per phone)
CREATE UNIQUE INDEX idx_whatsapp_users_phone ON public.whatsapp_users (phone_number);
CREATE INDEX idx_whatsapp_users_user_id ON public.whatsapp_users (user_id);

-- Enable RLS
ALTER TABLE public.whatsapp_users ENABLE ROW LEVEL SECURITY;

-- Users can view their own WhatsApp links
CREATE POLICY "Users can view own whatsapp links"
  ON public.whatsapp_users FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own WhatsApp links
CREATE POLICY "Users can insert own whatsapp links"
  ON public.whatsapp_users FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own WhatsApp links
CREATE POLICY "Users can update own whatsapp links"
  ON public.whatsapp_users FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own WhatsApp links
CREATE POLICY "Users can delete own whatsapp links"
  ON public.whatsapp_users FOR DELETE
  USING (auth.uid() = user_id);

-- Timestamp trigger
CREATE TRIGGER update_whatsapp_users_updated_at
  BEFORE UPDATE ON public.whatsapp_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
