-- Create subscription plan enum
CREATE TYPE public.subscription_plan AS ENUM ('Monthly', 'Yearly');

-- Create gyms table
CREATE TABLE public.gyms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_name text NOT NULL,
    gym_email text NOT NULL,
    subscription_plan subscription_plan NOT NULL,
    auth_uid text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;

-- Admins can do everything with gyms
CREATE POLICY "Admins can view all gyms"
ON public.gyms
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create gyms"
ON public.gyms
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update gyms"
ON public.gyms
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete gyms"
ON public.gyms
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Gym owners can view their own gym (when linked to user_id)
CREATE POLICY "Gym owners can view own gym"
ON public.gyms
FOR SELECT
USING (auth.uid() = user_id);

-- Function to generate unique UID
CREATE OR REPLACE FUNCTION public.generate_gym_uid()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    new_uid text;
    uid_exists boolean;
BEGIN
    LOOP
        -- Generate a 8-character alphanumeric UID
        new_uid := upper(substring(md5(random()::text) from 1 for 8));
        
        -- Check if it already exists
        SELECT EXISTS(SELECT 1 FROM public.gyms WHERE auth_uid = new_uid) INTO uid_exists;
        
        EXIT WHEN NOT uid_exists;
    END LOOP;
    
    RETURN new_uid;
END;
$$;

-- Function for gym login (returns gym id if credentials match)
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
    WHERE auth_uid = upper(p_uid) AND password_hash = crypt(p_password, password_hash);
    
    IF v_gym_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    IF NOT v_is_active THEN
        RETURN NULL;
    END IF;
    
    RETURN v_gym_id;
END;
$$;

-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Trigger for updated_at
CREATE TRIGGER update_gyms_updated_at
BEFORE UPDATE ON public.gyms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();