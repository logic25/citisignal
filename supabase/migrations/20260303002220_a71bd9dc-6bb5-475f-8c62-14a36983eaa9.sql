-- Add Telegram notification channel preferences to email_preferences
ALTER TABLE email_preferences
  ADD COLUMN IF NOT EXISTS telegram_new_violations boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS telegram_status_changes boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS telegram_new_applications boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS telegram_expirations boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS telegram_daily_summary boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS telegram_critical_alerts boolean DEFAULT true;