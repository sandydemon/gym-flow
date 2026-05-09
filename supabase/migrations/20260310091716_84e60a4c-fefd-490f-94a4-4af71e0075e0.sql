
CREATE TABLE public.body_measurements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paid_training_member_id uuid NOT NULL REFERENCES public.paid_training_members(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  chest numeric NULL,
  waist numeric NULL,
  hips numeric NULL,
  biceps numeric NULL,
  shoulders numeric NULL,
  thighs numeric NULL,
  calves numeric NULL,
  neck numeric NULL,
  recorded_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own measurements" ON public.body_measurements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own measurements" ON public.body_measurements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own measurements" ON public.body_measurements FOR DELETE USING (auth.uid() = user_id);
