-- Add compliance_filings JSONB column to properties for storing NYC filing verification data
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS compliance_filings jsonb DEFAULT '{}';

-- Comment for clarity
COMMENT ON COLUMN public.properties.compliance_filings IS 'Cached compliance filing verification data from NYC Open Data (FISP, elevator, boiler, LL84)';
