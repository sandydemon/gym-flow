-- Create gym_fees table for tracking monthly fee collection from gyms
CREATE TABLE public.gym_fees (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    month TEXT NOT NULL, -- Format: YYYY-MM
    amount NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending', -- Pending, Paid
    payment_date DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(gym_id, month)
);

-- Enable RLS
ALTER TABLE public.gym_fees ENABLE ROW LEVEL SECURITY;

-- RLS policies - only admins can manage gym fees
CREATE POLICY "Admins can view all gym fees"
ON public.gym_fees
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert gym fees"
ON public.gym_fees
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update gym fees"
ON public.gym_fees
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete gym fees"
ON public.gym_fees
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Gym owners can view their own fees
CREATE POLICY "Gym owners can view own fees"
ON public.gym_fees
FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.gyms 
    WHERE gyms.id = gym_fees.gym_id 
    AND gyms.user_id = auth.uid()
));

-- Create function to generate pending fees for all active gyms
CREATE OR REPLACE FUNCTION public.generate_monthly_gym_fees(p_month TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    -- Check if caller is admin
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: Admin access required';
    END IF;
    
    -- Insert pending fees for all active gyms that don't have a fee for this month
    INSERT INTO public.gym_fees (gym_id, month, amount, status)
    SELECT id, p_month, subscription_amount, 'Pending'
    FROM public.gyms
    WHERE is_active = true
    AND NOT EXISTS (
        SELECT 1 FROM public.gym_fees 
        WHERE gym_fees.gym_id = gyms.id 
        AND gym_fees.month = p_month
    );
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- Create trigger for updated_at
CREATE TRIGGER update_gym_fees_updated_at
BEFORE UPDATE ON public.gym_fees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();