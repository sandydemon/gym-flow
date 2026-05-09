-- Add subscription_amount column to gyms table
ALTER TABLE public.gyms 
ADD COLUMN subscription_amount numeric NOT NULL DEFAULT 0;