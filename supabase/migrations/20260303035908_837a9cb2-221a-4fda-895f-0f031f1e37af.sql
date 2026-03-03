
-- Add commercial tenant enrichment columns to tenants table
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS tenant_sqft numeric;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS annual_escalation_pct numeric;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS option_terms text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS use_clause text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS guarantor_name text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS guarantor_phone text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS move_in_date date;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS parking_spaces integer;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS ti_allowance numeric;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS percentage_rent numeric;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS percentage_rent_breakpoint numeric;
