-- Update generate_member_code function to use gym-specific prefixes
-- Each gym gets a 3-letter prefix based on their gym name

CREATE OR REPLACE FUNCTION public.generate_member_code(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
  new_code TEXT;
  gym_prefix TEXT;
BEGIN
  -- Get gym name and make a 3-letter uppercase prefix
  SELECT UPPER(REGEXP_REPLACE(SUBSTRING(COALESCE(gym_name, 'GYM'), 1, 3), '[^A-Za-z]', '', 'g'))
  INTO gym_prefix
  FROM public.profiles
  WHERE user_id = _user_id;

  -- Fallback if no gym name found
  IF gym_prefix IS NULL OR gym_prefix = '' THEN
    gym_prefix := 'GYM';
  END IF;

  -- Get next number for this user
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(member_code FROM LENGTH(gym_prefix) + 1) AS INTEGER)
  ), 0) + 1
  INTO next_num
  FROM public.members
  WHERE user_id = _user_id
    AND member_code ~ ('^' || gym_prefix || '[0-9]+$');

  new_code := gym_prefix || LPAD(next_num::text, 3, '0');
  RETURN new_code;
END;
$$;
