-- Staff salaries table (monthly records + advances)
CREATE TABLE public.staff_salaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  staff_id UUID NOT NULL,
  month TEXT NOT NULL, -- 'yyyy-MM'
  base_salary NUMERIC NOT NULL DEFAULT 0,
  advance_amount NUMERIC NOT NULL DEFAULT 0,
  deduction_amount NUMERIC NOT NULL DEFAULT 0,
  net_paid NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Unpaid', -- Paid | Unpaid
  payment_date DATE,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, staff_id, month)
);

ALTER TABLE public.staff_salaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own staff salaries" ON public.staff_salaries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own staff salaries" ON public.staff_salaries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own staff salaries" ON public.staff_salaries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own staff salaries" ON public.staff_salaries FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_staff_salaries_updated_at BEFORE UPDATE ON public.staff_salaries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Staff advances (separate ledger so deductions can be tracked over multiple months)
CREATE TABLE public.staff_advances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  staff_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  advance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  deducted_amount NUMERIC NOT NULL DEFAULT 0,
  is_settled BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_advances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own staff advances" ON public.staff_advances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own staff advances" ON public.staff_advances FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own staff advances" ON public.staff_advances FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own staff advances" ON public.staff_advances FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_staff_advances_updated_at BEFORE UPDATE ON public.staff_advances
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Member notes + package fields
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS package_name TEXT,
  ADD COLUMN IF NOT EXISTS package_duration_months INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS expiry_date DATE;

-- Payment method on monthly fees
ALTER TABLE public.monthly_fees
  ADD COLUMN IF NOT EXISTS payment_method TEXT;