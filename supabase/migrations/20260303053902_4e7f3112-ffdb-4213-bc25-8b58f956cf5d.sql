-- Add exemption tracking columns
ALTER TABLE public.property_taxes ADD COLUMN IF NOT EXISTS exemption_type text;
ALTER TABLE public.property_taxes ADD COLUMN IF NOT EXISTS exemption_start_date date;
ALTER TABLE public.property_taxes ADD COLUMN IF NOT EXISTS exemption_end_date date;
ALTER TABLE public.property_taxes ADD COLUMN IF NOT EXISTS exemption_notes text;

-- Add quarterly installment tracking (NYC quarterly: Q1=Jul, Q2=Oct, Q3=Jan, Q4=Apr)
ALTER TABLE public.property_taxes ADD COLUMN IF NOT EXISTS q1_amount numeric;
ALTER TABLE public.property_taxes ADD COLUMN IF NOT EXISTS q1_paid numeric DEFAULT 0;
ALTER TABLE public.property_taxes ADD COLUMN IF NOT EXISTS q1_due_date date;
ALTER TABLE public.property_taxes ADD COLUMN IF NOT EXISTS q1_status text DEFAULT 'unpaid';

ALTER TABLE public.property_taxes ADD COLUMN IF NOT EXISTS q2_amount numeric;
ALTER TABLE public.property_taxes ADD COLUMN IF NOT EXISTS q2_paid numeric DEFAULT 0;
ALTER TABLE public.property_taxes ADD COLUMN IF NOT EXISTS q2_due_date date;
ALTER TABLE public.property_taxes ADD COLUMN IF NOT EXISTS q2_status text DEFAULT 'unpaid';

ALTER TABLE public.property_taxes ADD COLUMN IF NOT EXISTS q3_amount numeric;
ALTER TABLE public.property_taxes ADD COLUMN IF NOT EXISTS q3_paid numeric DEFAULT 0;
ALTER TABLE public.property_taxes ADD COLUMN IF NOT EXISTS q3_due_date date;
ALTER TABLE public.property_taxes ADD COLUMN IF NOT EXISTS q3_status text DEFAULT 'unpaid';

ALTER TABLE public.property_taxes ADD COLUMN IF NOT EXISTS q4_amount numeric;
ALTER TABLE public.property_taxes ADD COLUMN IF NOT EXISTS q4_paid numeric DEFAULT 0;
ALTER TABLE public.property_taxes ADD COLUMN IF NOT EXISTS q4_due_date date;
ALTER TABLE public.property_taxes ADD COLUMN IF NOT EXISTS q4_status text DEFAULT 'unpaid';

-- Add attorney phone for protest management
ALTER TABLE public.property_taxes ADD COLUMN IF NOT EXISTS attorney_phone text;
ALTER TABLE public.property_taxes ADD COLUMN IF NOT EXISTS attorney_email text;