
-- Paid training members table
CREATE TABLE public.paid_training_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  height numeric,
  target text NOT NULL DEFAULT 'general',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(member_id, user_id)
);

ALTER TABLE public.paid_training_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own paid training members" ON public.paid_training_members FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own paid training members" ON public.paid_training_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own paid training members" ON public.paid_training_members FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own paid training members" ON public.paid_training_members FOR DELETE USING (auth.uid() = user_id);

-- Weight progress table
CREATE TABLE public.weight_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paid_training_member_id uuid NOT NULL REFERENCES public.paid_training_members(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  weight numeric NOT NULL,
  recorded_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.weight_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own weight progress" ON public.weight_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own weight progress" ON public.weight_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own weight progress" ON public.weight_progress FOR DELETE USING (auth.uid() = user_id);

-- Progress photos table
CREATE TABLE public.progress_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paid_training_member_id uuid NOT NULL REFERENCES public.paid_training_members(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  photo_url text NOT NULL,
  label text,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress photos" ON public.progress_photos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own progress photos" ON public.progress_photos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own progress photos" ON public.progress_photos FOR DELETE USING (auth.uid() = user_id);

-- Storage bucket for progress photos
INSERT INTO storage.buckets (id, name, public) VALUES ('progress-photos', 'progress-photos', true);

-- Storage RLS policies
CREATE POLICY "Users can upload progress photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'progress-photos' AND auth.role() = 'authenticated');
CREATE POLICY "Anyone can view progress photos" ON storage.objects FOR SELECT USING (bucket_id = 'progress-photos');
CREATE POLICY "Users can delete own progress photos" ON storage.objects FOR DELETE USING (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
