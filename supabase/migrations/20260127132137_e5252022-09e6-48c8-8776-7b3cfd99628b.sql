-- Remove legacy authentication functions that bypass Supabase Auth
DROP FUNCTION IF EXISTS public.verify_gym_login(text, text);
DROP FUNCTION IF EXISTS public.create_gym(text, text, text, text);

-- Remove sensitive columns from gyms table that are no longer needed
-- Since all gyms now use Supabase Auth (user_id column), we don't need:
-- - password_hash: was used for custom password verification
-- - auth_uid: was used as a custom gym identifier for legacy login
ALTER TABLE public.gyms DROP COLUMN IF EXISTS password_hash;
ALTER TABLE public.gyms DROP COLUMN IF EXISTS auth_uid;