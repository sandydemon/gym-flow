-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Recreate the create_gym function to use extensions schema for crypto functions
CREATE OR REPLACE FUNCTION public.create_gym(p_gym_name text, p_gym_email text, p_subscription_plan text, p_password text)
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
    
    -- Insert the gym with hashed password using extensions.crypt and extensions.gen_salt
    INSERT INTO public.gyms (gym_name, gym_email, subscription_plan, auth_uid, password_hash)
    VALUES (p_gym_name, p_gym_email, p_subscription_plan::subscription_plan, v_uid, extensions.crypt(p_password, extensions.gen_salt('bf')))
    RETURNING id INTO v_gym_id;
    
    RETURN QUERY SELECT v_gym_id, v_uid;
END;
$$;

-- Also update verify_gym_login to use extensions schema
CREATE OR REPLACE FUNCTION public.verify_gym_login(p_uid text, p_password text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_gym_id uuid;
    v_is_active boolean;
BEGIN
    SELECT id, is_active INTO v_gym_id, v_is_active
    FROM public.gyms
    WHERE auth_uid = upper(p_uid) AND password_hash = extensions.crypt(p_password, password_hash);
    
    IF v_gym_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    IF NOT v_is_active THEN
        RETURN NULL;
    END IF;
    
    RETURN v_gym_id;
END;
$$;