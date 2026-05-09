-- Function to create a new admin user (must be called after user signs up)
CREATE OR REPLACE FUNCTION public.grant_admin_role(target_user_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_target_user_id uuid;
BEGIN
    -- Check if caller is admin
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: Admin access required';
    END IF;
    
    -- Find user by email in auth.users
    SELECT id INTO v_target_user_id
    FROM auth.users
    WHERE email = lower(trim(target_user_email));
    
    IF v_target_user_id IS NULL THEN
        RAISE EXCEPTION 'User with email % not found. They must sign up first.', target_user_email;
    END IF;
    
    -- Check if already admin
    IF public.has_role(v_target_user_id, 'admin') THEN
        RAISE EXCEPTION 'User is already an admin';
    END IF;
    
    -- Grant admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_target_user_id, 'admin');
    
    RETURN v_target_user_id;
END;
$$;