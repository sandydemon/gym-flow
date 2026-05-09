
-- Add logo_url column to profiles
ALTER TABLE public.profiles ADD COLUMN logo_url text;

-- Create storage bucket for gym logos
INSERT INTO storage.buckets (id, name, public) VALUES ('gym-logos', 'gym-logos', true);

-- Storage policies for gym logos
CREATE POLICY "Anyone can view gym logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'gym-logos');

CREATE POLICY "Authenticated users can upload gym logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'gym-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own gym logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'gym-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own gym logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'gym-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
