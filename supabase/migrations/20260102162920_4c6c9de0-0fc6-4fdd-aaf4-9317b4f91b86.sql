-- Fix search path for generate_gym_uid function
CREATE OR REPLACE FUNCTION public.generate_gym_uid()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    new_uid text;
    uid_exists boolean;
BEGIN
    LOOP
        new_uid := upper(substring(md5(random()::text) from 1 for 8));
        SELECT EXISTS(SELECT 1 FROM public.gyms WHERE auth_uid = new_uid) INTO uid_exists;
        EXIT WHEN NOT uid_exists;
    END LOOP;
    RETURN new_uid;
END;
$$;

-- Function to create a gym (handles password hashing)
CREATE OR REPLACE FUNCTION public.create_gym(
    p_gym_name text,
    p_gym_email text,
    p_subscription_plan text,
    p_password text
)
RETURNS TABLE(gym_id uuid, auth_uid text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid text;
    v_gym_id uuid;
BEGIN
    -- Check if caller is admin
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: Admin access required';
    END IF;
    
    -- Generate unique UID
    v_uid := public.generate_gym_uid();
    
    -- Insert the gym with hashed password
    INSERT INTO public.gyms (gym_name, gym_email, subscription_plan, auth_uid, password_hash)
    VALUES (p_gym_name, p_gym_email, p_subscription_plan::subscription_plan, v_uid, crypt(p_password, gen_salt('bf')))
    RETURNING id INTO v_gym_id;
    
    RETURN QUERY SELECT v_gym_id, v_uid;
END;
$$;