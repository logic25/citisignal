
-- Add configurable reminder intervals to email_preferences
ALTER TABLE public.email_preferences 
ADD COLUMN IF NOT EXISTS reminder_days integer[] NOT NULL DEFAULT '{30,14,7,3,1}';

-- Add comment for clarity
COMMENT ON COLUMN public.email_preferences.reminder_days IS 'Array of day intervals before expiration to send reminders (e.g. {30,14,7,3,1})';
