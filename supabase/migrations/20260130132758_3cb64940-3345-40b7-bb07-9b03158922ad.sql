-- Add new columns to gyms table for extended details
ALTER TABLE public.gyms
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS owner_name text;