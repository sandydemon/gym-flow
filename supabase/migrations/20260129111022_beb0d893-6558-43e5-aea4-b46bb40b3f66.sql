-- Add admission fee columns to members table
ALTER TABLE public.members 
ADD COLUMN admission_fee numeric NOT NULL DEFAULT 0,
ADD COLUMN admission_fee_paid boolean NOT NULL DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.members.admission_fee IS 'One-time admission fee charged at joining';
COMMENT ON COLUMN public.members.admission_fee_paid IS 'Whether the admission fee has been collected';