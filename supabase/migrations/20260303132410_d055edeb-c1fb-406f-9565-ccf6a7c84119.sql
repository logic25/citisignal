ALTER TABLE public.email_preferences 
ADD COLUMN IF NOT EXISTS notify_tenant_insurance_expiry boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS tenant_reminder_days integer[] NOT NULL DEFAULT '{30,14,7}'::integer[];