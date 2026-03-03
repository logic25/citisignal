
-- Replace generate_deadline_reminders to add vendor COI expirations
-- and respect user-configurable reminder_days from email_preferences
CREATE OR REPLACE FUNCTION public.generate_deadline_reminders()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_record RECORD;
  v_days_until INTEGER;
  v_reminder_label TEXT;
  v_priority TEXT;
  v_notification_exists BOOLEAN;
  v_user_reminder_days integer[];
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

    -- Get user's configured reminder days
    SELECT COALESCE(ep.reminder_days, '{30,14,7,3,1}')
    INTO v_user_reminder_days
    FROM email_preferences ep WHERE ep.user_id = v_record.user_id;
    IF v_user_reminder_days IS NULL THEN v_user_reminder_days := '{30,14,7,3,1}'; END IF;

    v_days_until := (v_record.deadline_date::date - CURRENT_DATE);
    IF NOT (v_days_until = ANY(v_user_reminder_days)) THEN CONTINUE; END IF;

    IF v_days_until <= 1 THEN v_reminder_label := 'Tomorrow'; v_priority := 'critical';
    ELSIF v_days_until <= 3 THEN v_reminder_label := 'In ' || v_days_until || ' days'; v_priority := 'high';
    ELSIF v_days_until <= 7 THEN v_reminder_label := 'In ' || v_days_until || ' days'; v_priority := 'high';
    ELSE v_reminder_label := 'In ' || v_days_until || ' days'; v_priority := 'normal';
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
    SELECT COALESCE(ep.reminder_days, '{30,14,7,3,1}')
    INTO v_user_reminder_days
    FROM email_preferences ep WHERE ep.user_id = v_record.user_id;
    IF v_user_reminder_days IS NULL THEN v_user_reminder_days := '{30,14,7,3,1}'; END IF;

    v_days_until := (v_record.expiration_date::date - CURRENT_DATE);
    IF NOT (v_days_until = ANY(v_user_reminder_days)) THEN CONTINUE; END IF;

    IF v_days_until <= 1 THEN v_reminder_label := 'Tomorrow'; v_priority := 'critical';
    ELSIF v_days_until <= 3 THEN v_reminder_label := 'In ' || v_days_until || ' days'; v_priority := 'high';
    ELSIF v_days_until <= 7 THEN v_reminder_label := 'In ' || v_days_until || ' days'; v_priority := 'high';
    ELSE v_reminder_label := 'In ' || v_days_until || ' days'; v_priority := 'normal';
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

  -- Process insurance expirations
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
    SELECT COALESCE(ep.reminder_days, '{30,14,7,3,1}')
    INTO v_user_reminder_days
    FROM email_preferences ep WHERE ep.user_id = v_record.user_id;
    IF v_user_reminder_days IS NULL THEN v_user_reminder_days := '{30,14,7,3,1}'; END IF;

    v_days_until := (v_record.expiration_date::date - CURRENT_DATE);
    IF NOT (v_days_until = ANY(v_user_reminder_days)) THEN CONTINUE; END IF;

    IF v_days_until <= 1 THEN v_reminder_label := 'Tomorrow'; v_priority := 'critical';
    ELSIF v_days_until <= 3 THEN v_reminder_label := 'In ' || v_days_until || ' days'; v_priority := 'high';
    ELSIF v_days_until <= 7 THEN v_reminder_label := 'In ' || v_days_until || ' days'; v_priority := 'high';
    ELSE v_reminder_label := 'In ' || v_days_until || ' days'; v_priority := 'normal';
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

  -- Process tax exemption expirations
  FOR v_record IN
    SELECT 
      te.id as entity_id, te.exemption_type, te.program_name, te.expiration_date, te.property_id,
      p.address as property_address, p.user_id
    FROM tax_exemptions te
    JOIN properties p ON p.id = te.property_id
    WHERE te.expiration_date IS NOT NULL AND te.status = 'active'
  LOOP
    SELECT COALESCE(ep.reminder_days, '{30,14,7,3,1}')
    INTO v_user_reminder_days
    FROM email_preferences ep WHERE ep.user_id = v_record.user_id;
    IF v_user_reminder_days IS NULL THEN v_user_reminder_days := '{30,14,7,3,1}'; END IF;

    v_days_until := (v_record.expiration_date::date - CURRENT_DATE);
    IF NOT (v_days_until = ANY(v_user_reminder_days)) THEN CONTINUE; END IF;

    IF v_days_until <= 7 THEN v_reminder_label := 'In ' || v_days_until || ' days'; v_priority := 'high';
    ELSE v_reminder_label := 'In ' || v_days_until || ' days'; v_priority := 'normal';
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

  -- NEW: Process vendor COI expirations
  FOR v_record IN
    SELECT 
      vn.id as entity_id, vn.name as vendor_name, vn.coi_expiration_date as expiration_date,
      vn.user_id, vn.trade_type
    FROM vendors vn
    WHERE vn.coi_expiration_date IS NOT NULL AND vn.status = 'active'
  LOOP
    SELECT COALESCE(ep.reminder_days, '{30,14,7,3,1}')
    INTO v_user_reminder_days
    FROM email_preferences ep WHERE ep.user_id = v_record.user_id;
    IF v_user_reminder_days IS NULL THEN v_user_reminder_days := '{30,14,7,3,1}'; END IF;

    v_days_until := (v_record.expiration_date::date - CURRENT_DATE);
    IF NOT (v_days_until = ANY(v_user_reminder_days)) THEN CONTINUE; END IF;

    IF v_days_until <= 1 THEN v_reminder_label := 'Tomorrow'; v_priority := 'critical';
    ELSIF v_days_until <= 3 THEN v_reminder_label := 'In ' || v_days_until || ' days'; v_priority := 'high';
    ELSIF v_days_until <= 7 THEN v_reminder_label := 'In ' || v_days_until || ' days'; v_priority := 'high';
    ELSE v_reminder_label := 'In ' || v_days_until || ' days'; v_priority := 'normal';
    END IF;

    SELECT EXISTS(
      SELECT 1 FROM notifications 
      WHERE entity_id = v_record.entity_id::text AND entity_type = 'vendor_coi'
        AND category = 'deadline_reminder' AND user_id = v_record.user_id
        AND metadata->>'days_until' = v_days_until::text
        AND created_at > CURRENT_DATE - INTERVAL '1 day'
    ) INTO v_notification_exists;

    IF v_notification_exists THEN CONTINUE; END IF;

    INSERT INTO notifications (user_id, title, message, category, priority, entity_id, entity_type, metadata)
    VALUES (
      v_record.user_id,
      'Vendor COI Expires ' || v_reminder_label,
      v_record.vendor_name || COALESCE(' (' || v_record.trade_type || ')', '') || ' COI expires ' || to_char(v_record.expiration_date, 'Mon DD, YYYY'),
      'deadline_reminder', v_priority::notification_priority,
      v_record.entity_id::text, 'vendor_coi',
      jsonb_build_object('deadline_type', 'Vendor COI Expiration', 'deadline_date', v_record.expiration_date, 'days_until', v_days_until, 'vendor_name', v_record.vendor_name, 'trade_type', v_record.trade_type)
    );
  END LOOP;
END;
$function$;
