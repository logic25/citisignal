
-- Clean up existing violation duplicates (keep latest synced_at)
DELETE FROM violations v1
USING violations v2
WHERE v1.property_id = v2.property_id
  AND v1.violation_number = v2.violation_number
  AND v1.agency = v2.agency
  AND v1.synced_at < v2.synced_at;

-- Add unique constraint for violations
ALTER TABLE public.violations
  ADD CONSTRAINT violations_property_agency_number_unique
  UNIQUE (property_id, violation_number, agency);

-- Clean up existing application duplicates (keep latest updated_at)
DELETE FROM applications a1
USING applications a2
WHERE a1.property_id = a2.property_id
  AND a1.source = a2.source
  AND a1.application_number = a2.application_number
  AND a1.updated_at < a2.updated_at;

-- Add unique constraint for applications
ALTER TABLE public.applications
  ADD CONSTRAINT applications_property_source_number_unique
  UNIQUE (property_id, source, application_number);

-- Create sync_health_logs table
CREATE TABLE public.sync_health_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  endpoint_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'empty', 'error', 'timeout')),
  result_count integer DEFAULT 0,
  error_message text,
  response_time_ms integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.sync_health_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read sync health logs"
  ON public.sync_health_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_sync_health_logs_created ON sync_health_logs(created_at DESC);
CREATE INDEX idx_sync_health_logs_status ON sync_health_logs(status, created_at DESC);
