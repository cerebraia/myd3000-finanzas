-- Activity log table for audit trail
CREATE TABLE IF NOT EXISTS public.activity_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id),
  entity_type text NOT NULL,
  entity_id   uuid,
  action      text NOT NULL,
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_log_entity_idx ON public.activity_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS activity_log_created_at_idx ON public.activity_log (created_at DESC);

-- Enable RLS
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can SELECT and INSERT
CREATE POLICY "Authenticated users can view activity log"
  ON public.activity_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert activity log"
  ON public.activity_log FOR INSERT TO authenticated WITH CHECK (true);
