
-- Add new PLUTO neighborhood and lot fields to properties table
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS zoning_district_2 TEXT,
  ADD COLUMN IF NOT EXISTS zoning_district_3 TEXT,
  ADD COLUMN IF NOT EXISTS lot_frontage NUMERIC,
  ADD COLUMN IF NOT EXISTS lot_depth NUMERIC,
  ADD COLUMN IF NOT EXISTS school_district TEXT,
  ADD COLUMN IF NOT EXISTS police_precinct TEXT,
  ADD COLUMN IF NOT EXISTS fire_company TEXT,
  ADD COLUMN IF NOT EXISTS sanitation_borough TEXT,
  ADD COLUMN IF NOT EXISTS sanitation_subsection TEXT,
  ADD COLUMN IF NOT EXISTS land_use TEXT,
  ADD COLUMN IF NOT EXISTS total_units INTEGER,
  ADD COLUMN IF NOT EXISTS split_zone BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS limited_height_district TEXT;
