
CREATE OR REPLACE FUNCTION public.notify_overdue_tax()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_address text;
BEGIN
  IF NEW.payment_status IN ('unpaid', 'partial') AND NEW.due_date IS NOT NULL AND NEW.due_date < CURRENT_DATE THEN
    SELECT user_id, address INTO v_user_id, v_address
    FROM properties WHERE id = NEW.property_id;

    IF v_user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, property_id, title, message, priority, category, entity_type, entity_id)
      VALUES (
        v_user_id, NEW.property_id,
        'Tax Payment Overdue',
        'Tax Year ' || NEW.tax_year || ' for ' || v_address || ' has $' || COALESCE(NEW.tax_amount - COALESCE(NEW.amount_paid, 0), 0)::TEXT || ' balance due',
        'high',
        'taxes',
        'property_tax',
        NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
