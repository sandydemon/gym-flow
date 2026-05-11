-- Add unique constraint on (user_id, phone) to prevent duplicate members
-- This allows null phone numbers but prevents duplicate non-null phone numbers per user

ALTER TABLE public.members 
ADD CONSTRAINT members_user_id_phone_key 
UNIQUE (user_id, phone) 
DEFERRABLE INITIALLY DEFERRED;

-- Create index for better performance on the unique constraint
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_members_user_phone 
ON public.members (user_id, phone) 
WHERE phone IS NOT NULL;
