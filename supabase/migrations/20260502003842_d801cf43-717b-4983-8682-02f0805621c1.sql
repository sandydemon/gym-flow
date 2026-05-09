-- Add member_code column for unique per-gym IDs (e.g. GYM001)
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS member_code TEXT;

-- Unique per gym owner
CREATE UNIQUE INDEX IF NOT EXISTS members_user_member_code_key 
  ON public.members(user_id, member_code) 
  WHERE member_code IS NOT NULL;

-- Function to generate next member_code per user
CREATE OR REPLACE FUNCTION public.generate_member_code(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
  new_code TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(member_code FROM 4) AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.members
  WHERE user_id = _user_id
    AND member_code ~ '^GYM[0-9]+$';
  
  new_code := 'GYM' || LPAD(next_num::text, 3, '0');
  RETURN new_code;
END;
$$;

-- Trigger function to auto-assign member_code on insert
CREATE OR REPLACE FUNCTION public.set_member_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.member_code IS NULL OR NEW.member_code = '' THEN
    NEW.member_code := public.generate_member_code(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_member_code ON public.members;
CREATE TRIGGER trg_set_member_code
  BEFORE INSERT ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.set_member_code();

-- Backfill existing members with codes (per user, ordered by created_at)
DO $$
DECLARE
  rec RECORD;
  counters JSONB := '{}'::jsonb;
  current_count INT;
BEGIN
  FOR rec IN 
    SELECT id, user_id 
    FROM public.members 
    WHERE member_code IS NULL 
    ORDER BY user_id, created_at
  LOOP
    current_count := COALESCE((counters->>rec.user_id::text)::int, 
      (SELECT COALESCE(MAX(CAST(SUBSTRING(member_code FROM 4) AS INTEGER)), 0) 
       FROM public.members 
       WHERE user_id = rec.user_id AND member_code ~ '^GYM[0-9]+$')
    ) + 1;
    
    UPDATE public.members 
    SET member_code = 'GYM' || LPAD(current_count::text, 3, '0')
    WHERE id = rec.id;
    
    counters := jsonb_set(counters, ARRAY[rec.user_id::text], to_jsonb(current_count));
  END LOOP;
END $$;