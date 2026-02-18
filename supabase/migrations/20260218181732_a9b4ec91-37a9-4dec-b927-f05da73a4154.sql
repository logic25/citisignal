-- Add telegram_chat_id to vendors for direct Telegram messaging
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS telegram_chat_id bigint;
