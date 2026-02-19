
-- ==========================================
-- TAX ENHANCEMENTS
-- ==========================================

-- Add new columns to property_taxes
ALTER TABLE public.property_taxes 
  ADD COLUMN IF NOT EXISTS tax_rate numeric,
  ADD COLUMN IF NOT EXISTS attorney_name text,
  ADD COLUMN IF NOT EXISTS attorney_firm text,
  ADD COLUMN IF NOT EXISTS attorney_fee numeric;

-- Auto-calculate balance_due trigger
CREATE OR REPLACE FUNCTION public.auto_calculate_tax_balance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.balance_due := COALESCE(NEW.tax_amount, 0) - COALESCE(NEW.amount_paid, 0);
  IF NEW.balance_due < 0 THEN
    NEW.balance_due := 0;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_calc_tax_balance
  BEFORE INSERT OR UPDATE ON public.property_taxes
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_calculate_tax_balance();

-- Tax installments table (quarterly payments)
CREATE TABLE public.tax_installments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_tax_id uuid NOT NULL REFERENCES public.property_taxes(id) ON DELETE CASCADE,
  quarter integer NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  due_date date,
  amount_due numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  paid_date date,
  payment_status text NOT NULL DEFAULT 'unpaid',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(property_tax_id, quarter)
);

ALTER TABLE public.tax_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view installments for their taxes"
  ON public.tax_installments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM property_taxes pt 
    JOIN properties p ON p.id = pt.property_id 
    WHERE pt.id = tax_installments.property_tax_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert installments for their taxes"
  ON public.tax_installments FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM property_taxes pt 
    JOIN properties p ON p.id = pt.property_id 
    WHERE pt.id = tax_installments.property_tax_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Users can update installments for their taxes"
  ON public.tax_installments FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM property_taxes pt 
    JOIN properties p ON p.id = pt.property_id 
    WHERE pt.id = tax_installments.property_tax_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete installments for their taxes"
  ON public.tax_installments FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM property_taxes pt 
    JOIN properties p ON p.id = pt.property_id 
    WHERE pt.id = tax_installments.property_tax_id AND p.user_id = auth.uid()
  ));

-- Tax exemptions/abatements table
CREATE TABLE public.tax_exemptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  exemption_type text NOT NULL, -- '421-a', 'ICAP', 'J-51', 'STAR', 'Vet', 'Other'
  program_name text,
  start_date date,
  expiration_date date,
  annual_savings numeric,
  status text NOT NULL DEFAULT 'active', -- 'active', 'expired', 'pending'
  application_number text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.tax_exemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view exemptions for their properties"
  ON public.tax_exemptions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM properties WHERE properties.id = tax_exemptions.property_id AND properties.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert exemptions for their properties"
  ON public.tax_exemptions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM properties WHERE properties.id = tax_exemptions.property_id AND properties.user_id = auth.uid()
  ));

CREATE POLICY "Users can update exemptions for their properties"
  ON public.tax_exemptions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM properties WHERE properties.id = tax_exemptions.property_id AND properties.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete exemptions for their properties"
  ON public.tax_exemptions FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM properties WHERE properties.id = tax_exemptions.property_id AND properties.user_id = auth.uid()
  ));

-- ==========================================
-- INSURANCE / COI TRACKING
-- ==========================================

CREATE TABLE public.tenant_insurance_policies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  policy_type text NOT NULL, -- 'general_liability', 'workers_comp', 'property_contents', 'umbrella', 'auto', 'other'
  carrier_name text,
  policy_number text,
  coverage_amount numeric,
  required_minimum numeric,
  expiration_date date,
  effective_date date,
  certificate_url text,
  additional_insured boolean NOT NULL DEFAULT false,
  additional_insured_required boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active', -- 'active', 'expired', 'missing', 'pending'
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_insurance_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view insurance for their properties"
  ON public.tenant_insurance_policies FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM properties WHERE properties.id = tenant_insurance_policies.property_id AND properties.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert insurance for their properties"
  ON public.tenant_insurance_policies FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM properties WHERE properties.id = tenant_insurance_policies.property_id AND properties.user_id = auth.uid()
  ));

CREATE POLICY "Users can update insurance for their properties"
  ON public.tenant_insurance_policies FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM properties WHERE properties.id = tenant_insurance_policies.property_id AND properties.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete insurance for their properties"
  ON public.tenant_insurance_policies FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM properties WHERE properties.id = tenant_insurance_policies.property_id AND properties.user_id = auth.uid()
  ));

-- Add insurance expiration reminders to the deadline generator
CREATE OR REPLACE FUNCTION public.generate_deadline_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record RECORD;
  v_days_until INTEGER;
  v_reminder_label TEXT;
  v_priority TEXT;
  v_notification_exists BOOLEAN;
BEGIN
  -- Process violation deadlines
  FOR v_record IN
    SELECT 
      v.id as entity_id,
      v.violation_number,
      v.agency,
      v.property_id,
      p.address as property_address,
      p.user_id,
      unnest(ARRAY[
        CASE WHEN v.hearing_date IS NOT NULL THEN v.hearing_date END,
        CASE WHEN v.cure_due_date IS NOT NULL THEN v.cure_due_date END,
        CASE WHEN v.certification_due_date IS NOT NULL THEN v.certification_due_date END
      ]) as deadline_date,
      unnest(ARRAY[
        CASE WHEN v.hearing_date IS NOT NULL THEN 'Hearing' END,
        CASE WHEN v.cure_due_date IS NOT NULL THEN 'Cure Deadline' END,
        CASE WHEN v.certification_due_date IS NOT NULL THEN 'Certification' END
      ]) as deadline_type
    FROM violations v
    JOIN properties p ON p.id = v.property_id
    WHERE v.status != 'closed'
      AND (v.hearing_date IS NOT NULL OR v.cure_due_date IS NOT NULL OR v.certification_due_date IS NOT NULL)
  LOOP
    IF v_record.deadline_date IS NULL OR v_record.deadline_type IS NULL THEN
      CONTINUE;
    END IF;

    v_days_until := (v_record.deadline_date::date - CURRENT_DATE);
    IF v_days_until NOT IN (7, 3, 1) THEN CONTINUE; END IF;

    IF v_days_until = 1 THEN v_reminder_label := 'Tomorrow'; v_priority := 'critical';
    ELSIF v_days_until = 3 THEN v_reminder_label := 'In 3 days'; v_priority := 'high';
    ELSE v_reminder_label := 'In 7 days'; v_priority := 'normal';
    END IF;

    SELECT EXISTS(
      SELECT 1 FROM notifications 
      WHERE entity_id = v_record.entity_id::text AND entity_type = 'violation'
        AND category = 'deadline_reminder' AND user_id = v_record.user_id
        AND metadata->>'deadline_type' = v_record.deadline_type
        AND metadata->>'days_until' = v_days_until::text
        AND created_at > CURRENT_DATE - INTERVAL '1 day'
    ) INTO v_notification_exists;

    IF v_notification_exists THEN CONTINUE; END IF;

    INSERT INTO notifications (user_id, title, message, category, priority, property_id, entity_id, entity_type, metadata)
    VALUES (
      v_record.user_id,
      v_record.deadline_type || ' ' || v_reminder_label,
      v_record.agency || ' #' || v_record.violation_number || ' at ' || v_record.property_address || ' — ' || v_record.deadline_type || ' due ' || to_char(v_record.deadline_date, 'Mon DD, YYYY'),
      'deadline_reminder', v_priority::notification_priority,
      v_record.property_id, v_record.entity_id::text, 'violation',
      jsonb_build_object('deadline_type', v_record.deadline_type, 'deadline_date', v_record.deadline_date, 'days_until', v_days_until, 'agency', v_record.agency, 'violation_number', v_record.violation_number)
    );
  END LOOP;

  -- Process document expirations
  FOR v_record IN
    SELECT d.id as entity_id, d.document_name, d.document_type, d.expiration_date, d.property_id, p.address as property_address, p.user_id
    FROM property_documents d JOIN properties p ON p.id = d.property_id
    WHERE d.expiration_date IS NOT NULL AND (d.is_current IS NULL OR d.is_current = true)
  LOOP
    v_days_until := (v_record.expiration_date::date - CURRENT_DATE);
    IF v_days_until NOT IN (7, 3, 1) THEN CONTINUE; END IF;

    IF v_days_until = 1 THEN v_reminder_label := 'Tomorrow'; v_priority := 'critical';
    ELSIF v_days_until = 3 THEN v_reminder_label := 'In 3 days'; v_priority := 'high';
    ELSE v_reminder_label := 'In 7 days'; v_priority := 'normal';
    END IF;

    SELECT EXISTS(
      SELECT 1 FROM notifications 
      WHERE entity_id = v_record.entity_id::text AND entity_type = 'document'
        AND category = 'deadline_reminder' AND user_id = v_record.user_id
        AND metadata->>'days_until' = v_days_until::text
        AND created_at > CURRENT_DATE - INTERVAL '1 day'
    ) INTO v_notification_exists;

    IF v_notification_exists THEN CONTINUE; END IF;

    INSERT INTO notifications (user_id, title, message, category, priority, property_id, entity_id, entity_type, metadata)
    VALUES (
      v_record.user_id,
      v_record.document_type || ' Expires ' || v_reminder_label,
      v_record.document_name || ' at ' || v_record.property_address || ' expires ' || to_char(v_record.expiration_date, 'Mon DD, YYYY'),
      'deadline_reminder', v_priority::notification_priority,
      v_record.property_id, v_record.entity_id::text, 'document',
      jsonb_build_object('deadline_type', 'Document Expiration', 'deadline_date', v_record.expiration_date, 'days_until', v_days_until, 'document_type', v_record.document_type, 'document_name', v_record.document_name)
    );
  END LOOP;

  -- Process insurance expirations (NEW)
  FOR v_record IN
    SELECT 
      ip.id as entity_id, ip.policy_type, ip.carrier_name, ip.expiration_date, ip.property_id,
      p.address as property_address, p.user_id,
      t.company_name as tenant_name
    FROM tenant_insurance_policies ip
    JOIN properties p ON p.id = ip.property_id
    JOIN tenants t ON t.id = ip.tenant_id
    WHERE ip.expiration_date IS NOT NULL AND ip.status = 'active'
  LOOP
    v_days_until := (v_record.expiration_date::date - CURRENT_DATE);
    IF v_days_until NOT IN (30, 14, 7, 3, 1) THEN CONTINUE; END IF;

    IF v_days_until = 1 THEN v_reminder_label := 'Tomorrow'; v_priority := 'critical';
    ELSIF v_days_until <= 3 THEN v_reminder_label := 'In ' || v_days_until || ' days'; v_priority := 'high';
    ELSIF v_days_until <= 7 THEN v_reminder_label := 'In 7 days'; v_priority := 'high';
    ELSIF v_days_until <= 14 THEN v_reminder_label := 'In 14 days'; v_priority := 'normal';
    ELSE v_reminder_label := 'In 30 days'; v_priority := 'normal';
    END IF;

    SELECT EXISTS(
      SELECT 1 FROM notifications 
      WHERE entity_id = v_record.entity_id::text AND entity_type = 'insurance'
        AND category = 'deadline_reminder' AND user_id = v_record.user_id
        AND metadata->>'days_until' = v_days_until::text
        AND created_at > CURRENT_DATE - INTERVAL '1 day'
    ) INTO v_notification_exists;

    IF v_notification_exists THEN CONTINUE; END IF;

    INSERT INTO notifications (user_id, title, message, category, priority, property_id, entity_id, entity_type, metadata)
    VALUES (
      v_record.user_id,
      'Insurance Expires ' || v_reminder_label,
      COALESCE(v_record.tenant_name, 'Tenant') || '''s ' || REPLACE(v_record.policy_type, '_', ' ') || ' policy at ' || v_record.property_address || ' expires ' || to_char(v_record.expiration_date, 'Mon DD, YYYY'),
      'deadline_reminder', v_priority::notification_priority,
      v_record.property_id, v_record.entity_id::text, 'insurance',
      jsonb_build_object('deadline_type', 'Insurance Expiration', 'deadline_date', v_record.expiration_date, 'days_until', v_days_until, 'policy_type', v_record.policy_type, 'carrier', v_record.carrier_name, 'tenant_name', v_record.tenant_name)
    );
  END LOOP;

  -- Process tax exemption expirations (NEW)
  FOR v_record IN
    SELECT 
      te.id as entity_id, te.exemption_type, te.program_name, te.expiration_date, te.property_id,
      p.address as property_address, p.user_id
    FROM tax_exemptions te
    JOIN properties p ON p.id = te.property_id
    WHERE te.expiration_date IS NOT NULL AND te.status = 'active'
  LOOP
    v_days_until := (v_record.expiration_date::date - CURRENT_DATE);
    IF v_days_until NOT IN (30, 14, 7) THEN CONTINUE; END IF;

    IF v_days_until <= 7 THEN v_reminder_label := 'In 7 days'; v_priority := 'high';
    ELSIF v_days_until <= 14 THEN v_reminder_label := 'In 14 days'; v_priority := 'normal';
    ELSE v_reminder_label := 'In 30 days'; v_priority := 'normal';
    END IF;

    SELECT EXISTS(
      SELECT 1 FROM notifications 
      WHERE entity_id = v_record.entity_id::text AND entity_type = 'tax_exemption'
        AND category = 'deadline_reminder' AND user_id = v_record.user_id
        AND metadata->>'days_until' = v_days_until::text
        AND created_at > CURRENT_DATE - INTERVAL '1 day'
    ) INTO v_notification_exists;

    IF v_notification_exists THEN CONTINUE; END IF;

    INSERT INTO notifications (user_id, title, message, category, priority, property_id, entity_id, entity_type, metadata)
    VALUES (
      v_record.user_id,
      v_record.exemption_type || ' Abatement Expires ' || v_reminder_label,
      COALESCE(v_record.program_name, v_record.exemption_type) || ' for ' || v_record.property_address || ' expires ' || to_char(v_record.expiration_date, 'Mon DD, YYYY'),
      'deadline_reminder', v_priority::notification_priority,
      v_record.property_id, v_record.entity_id::text, 'tax_exemption',
      jsonb_build_object('deadline_type', 'Exemption Expiration', 'deadline_date', v_record.expiration_date, 'days_until', v_days_until, 'exemption_type', v_record.exemption_type)
    );
  END LOOP;
END;
$$;
