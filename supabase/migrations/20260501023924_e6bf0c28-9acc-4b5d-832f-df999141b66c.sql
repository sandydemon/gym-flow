
-- Add trainer to paid training members
ALTER TABLE public.paid_training_members 
ADD COLUMN IF NOT EXISTS trainer_id uuid REFERENCES public.staff(id) ON DELETE SET NULL;

-- Workout plans table (one row per day per paid training member)
CREATE TABLE IF NOT EXISTS public.workout_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paid_training_member_id uuid NOT NULL,
  user_id uuid NOT NULL,
  day_of_week text NOT NULL,
  body_parts text[] NOT NULL DEFAULT '{}',
  cardio text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (paid_training_member_id, day_of_week)
);

ALTER TABLE public.workout_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workout plans"
ON public.workout_plans FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workout plans"
ON public.workout_plans FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workout plans"
ON public.workout_plans FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workout plans"
ON public.workout_plans FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_workout_plans_updated_at
BEFORE UPDATE ON public.workout_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
