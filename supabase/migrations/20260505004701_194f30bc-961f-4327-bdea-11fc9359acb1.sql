
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_owner_id uuid NOT NULL,
  user_id uuid NOT NULL,
  user_name text,
  user_role text,
  action_type text NOT NULL,
  description text,
  page text,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_logs_gym_created ON public.activity_logs (gym_owner_id, created_at DESC);
CREATE INDEX idx_activity_logs_user ON public.activity_logs (user_id);
CREATE INDEX idx_activity_logs_action ON public.activity_logs (action_type);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can view gym activity logs"
  ON public.activity_logs FOR SELECT
  TO authenticated
  USING (
    gym_owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Team can insert own activity logs"
  ON public.activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND gym_owner_id = public.get_gym_owner_id(auth.uid())
  );
