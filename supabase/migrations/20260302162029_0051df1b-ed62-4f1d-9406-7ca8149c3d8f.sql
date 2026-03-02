
-- ============================================================
-- Security Fix 12: notifications INSERT — restrict to own user_id
-- ============================================================
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON notifications;

CREATE POLICY "notifications_insert_own" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Security Fix 13: oath_hearings INSERT/UPDATE — restrict to user's properties
-- ============================================================
DROP POLICY IF EXISTS "oath_hearings_insert" ON oath_hearings;
DROP POLICY IF EXISTS "oath_hearings_update" ON oath_hearings;
DROP POLICY IF EXISTS "Users can insert oath hearings" ON oath_hearings;
DROP POLICY IF EXISTS "Users can update oath hearings" ON oath_hearings;

CREATE POLICY "oath_hearings_insert_own" ON oath_hearings
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = oath_hearings.property_id
      AND p.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM violations v
      JOIN properties p ON p.id = v.property_id
      WHERE v.id = oath_hearings.violation_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "oath_hearings_update_own" ON oath_hearings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = oath_hearings.property_id
      AND p.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM violations v
      JOIN properties p ON p.id = v.property_id
      WHERE v.id = oath_hearings.violation_id
      AND p.user_id = auth.uid()
    )
  );

-- ============================================================
-- Security Fix 14: compliance_scores — restrict to user's properties
-- ============================================================
DROP POLICY IF EXISTS "compliance_scores_all" ON compliance_scores;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON compliance_scores;
DROP POLICY IF EXISTS "Users can manage compliance scores" ON compliance_scores;

CREATE POLICY "compliance_scores_select_own" ON compliance_scores
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = compliance_scores.property_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "compliance_scores_insert_own" ON compliance_scores
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = compliance_scores.property_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "compliance_scores_update_own" ON compliance_scores
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = compliance_scores.property_id
      AND p.user_id = auth.uid()
    )
  );

-- ============================================================
-- Security Fix 15: email_log INSERT — restrict to own user_id
-- ============================================================
DROP POLICY IF EXISTS "email_log_insert" ON email_log;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON email_log;
DROP POLICY IF EXISTS "Users can insert email logs" ON email_log;

CREATE POLICY "email_log_insert_own" ON email_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Security Fix 16: change_log — restrict INSERT, remove UPDATE
-- ============================================================
DROP POLICY IF EXISTS "change_log_insert" ON change_log;
DROP POLICY IF EXISTS "change_log_update" ON change_log;
DROP POLICY IF EXISTS "Users can insert change logs" ON change_log;
DROP POLICY IF EXISTS "Users can update change logs" ON change_log;

CREATE POLICY "change_log_insert_own" ON change_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE policy — change_log entries are immutable audit records

-- ============================================================
-- Security Fix 17: work_order_messages — restrict to user's properties
-- ============================================================
DROP POLICY IF EXISTS "work_order_messages_select" ON work_order_messages;
DROP POLICY IF EXISTS "work_order_messages_insert" ON work_order_messages;
DROP POLICY IF EXISTS "Users can view work order messages" ON work_order_messages;
DROP POLICY IF EXISTS "Users can insert work order messages" ON work_order_messages;

CREATE POLICY "wom_select_own" ON work_order_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM work_orders wo
      JOIN properties p ON p.id = wo.property_id
      WHERE wo.id = work_order_messages.work_order_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "wom_insert_own" ON work_order_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM work_orders wo
      JOIN properties p ON p.id = wo.property_id
      WHERE wo.id = work_order_messages.work_order_id
      AND p.user_id = auth.uid()
    )
  );

-- ============================================================
-- Security Fix 18: property-documents storage INSERT — restrict to user's properties
-- ============================================================
DROP POLICY IF EXISTS "property_docs_insert" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload property documents" ON storage.objects;

CREATE POLICY "property_docs_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'property-documents'
    AND EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = (storage.foldername(name))[1]::uuid
      AND p.user_id = auth.uid()
    )
  );
