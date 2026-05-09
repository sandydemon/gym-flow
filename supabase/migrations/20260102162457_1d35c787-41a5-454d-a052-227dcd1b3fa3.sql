-- Function to allow first admin signup (when no admins exist)
CREATE OR REPLACE FUNCTION public.create_first_admin(admin_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_count integer;
BEGIN
  -- Check if any admin exists
  SELECT COUNT(*) INTO admin_count FROM public.user_roles WHERE role = 'admin';
  
  -- If no admin exists, allow creating the first one
  IF admin_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (admin_user_id, 'admin');
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;