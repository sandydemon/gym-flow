-- ============================================================
-- 1. gym_users table (sub-users belonging to a gym owner)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.gym_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,         -- the sub-user's auth user id
  gym_owner_id uuid NOT NULL,           -- the owner account they belong to
  role public.app_role NOT NULL,        -- 'trainer' or 'receptionist'
  staff_id uuid,                        -- optional link to staff row (for trainers)
  full_name text,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gym_users_owner ON public.gym_users(gym_owner_id);
CREATE INDEX IF NOT EXISTS idx_gym_users_user ON public.gym_users(user_id);

ALTER TABLE public.gym_users ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Helper: get the effective gym owner id for a user
--    - owners/admins: returns their own id
--    - sub-users: returns their gym_owner_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_gym_owner_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT gym_owner_id FROM public.gym_users WHERE user_id = _user_id AND is_active = true LIMIT 1),
    _user_id
  );
$$;

REVOKE EXECUTE ON FUNCTION public.get_gym_owner_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_gym_owner_id(uuid) TO authenticated;

-- Helper: get the role of a sub-user (null = owner)
CREATE OR REPLACE FUNCTION public.get_sub_user_role(_user_id uuid)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.gym_users WHERE user_id = _user_id AND is_active = true LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_sub_user_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_sub_user_role(uuid) TO authenticated;

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_gym_users_updated_at ON public.gym_users;
CREATE TRIGGER trg_gym_users_updated_at
BEFORE UPDATE ON public.gym_users
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. RLS for gym_users
-- ============================================================
DROP POLICY IF EXISTS "Owner can view own team" ON public.gym_users;
CREATE POLICY "Owner can view own team"
ON public.gym_users FOR SELECT TO authenticated
USING (gym_owner_id = auth.uid() OR user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Owner can insert own team" ON public.gym_users;
CREATE POLICY "Owner can insert own team"
ON public.gym_users FOR INSERT TO authenticated
WITH CHECK (gym_owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Owner can update own team" ON public.gym_users;
CREATE POLICY "Owner can update own team"
ON public.gym_users FOR UPDATE TO authenticated
USING (gym_owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Owner can delete own team" ON public.gym_users;
CREATE POLICY "Owner can delete own team"
ON public.gym_users FOR DELETE TO authenticated
USING (gym_owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 4. Rewrite RLS on all gym data tables to use get_gym_owner_id
-- ============================================================

-- helper to keep the SQL terse
-- members
DROP POLICY IF EXISTS "Users can view own members" ON public.members;
DROP POLICY IF EXISTS "Users can insert own members" ON public.members;
DROP POLICY IF EXISTS "Users can update own members" ON public.members;
DROP POLICY IF EXISTS "Users can delete own members" ON public.members;
CREATE POLICY "Gym team can view members" ON public.members FOR SELECT TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can insert members" ON public.members FOR INSERT TO authenticated WITH CHECK (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can update members" ON public.members FOR UPDATE TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can delete members" ON public.members FOR DELETE TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));

-- attendance
DROP POLICY IF EXISTS "Users can view own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Users can insert own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Users can delete own attendance" ON public.attendance;
CREATE POLICY "Gym team can view attendance" ON public.attendance FOR SELECT TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can insert attendance" ON public.attendance FOR INSERT TO authenticated WITH CHECK (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can delete attendance" ON public.attendance FOR DELETE TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));

-- monthly_fees
DROP POLICY IF EXISTS "Users can view own fees" ON public.monthly_fees;
DROP POLICY IF EXISTS "Users can insert own fees" ON public.monthly_fees;
DROP POLICY IF EXISTS "Users can update own fees" ON public.monthly_fees;
DROP POLICY IF EXISTS "Users can delete own fees" ON public.monthly_fees;
CREATE POLICY "Gym team can view fees" ON public.monthly_fees FOR SELECT TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can insert fees" ON public.monthly_fees FOR INSERT TO authenticated WITH CHECK (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can update fees" ON public.monthly_fees FOR UPDATE TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can delete fees" ON public.monthly_fees FOR DELETE TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));

-- expenses
DROP POLICY IF EXISTS "Users can view own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can insert own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can update own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can delete own expenses" ON public.expenses;
CREATE POLICY "Gym team can view expenses" ON public.expenses FOR SELECT TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can insert expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can update expenses" ON public.expenses FOR UPDATE TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can delete expenses" ON public.expenses FOR DELETE TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));

-- staff
DROP POLICY IF EXISTS "Users can view own staff" ON public.staff;
DROP POLICY IF EXISTS "Users can insert own staff" ON public.staff;
DROP POLICY IF EXISTS "Users can update own staff" ON public.staff;
DROP POLICY IF EXISTS "Users can delete own staff" ON public.staff;
CREATE POLICY "Gym team can view staff" ON public.staff FOR SELECT TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can insert staff" ON public.staff FOR INSERT TO authenticated WITH CHECK (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can update staff" ON public.staff FOR UPDATE TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can delete staff" ON public.staff FOR DELETE TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));

-- staff_attendance
DROP POLICY IF EXISTS "Users can view own staff attendance" ON public.staff_attendance;
DROP POLICY IF EXISTS "Users can insert own staff attendance" ON public.staff_attendance;
DROP POLICY IF EXISTS "Users can update own staff attendance" ON public.staff_attendance;
DROP POLICY IF EXISTS "Users can delete own staff attendance" ON public.staff_attendance;
CREATE POLICY "Gym team can view staff attendance" ON public.staff_attendance FOR SELECT TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can insert staff attendance" ON public.staff_attendance FOR INSERT TO authenticated WITH CHECK (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can update staff attendance" ON public.staff_attendance FOR UPDATE TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can delete staff attendance" ON public.staff_attendance FOR DELETE TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));

-- staff_salaries
DROP POLICY IF EXISTS "Users view own staff salaries" ON public.staff_salaries;
DROP POLICY IF EXISTS "Users insert own staff salaries" ON public.staff_salaries;
DROP POLICY IF EXISTS "Users update own staff salaries" ON public.staff_salaries;
DROP POLICY IF EXISTS "Users delete own staff salaries" ON public.staff_salaries;
CREATE POLICY "Gym team can view staff salaries" ON public.staff_salaries FOR SELECT TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can insert staff salaries" ON public.staff_salaries FOR INSERT TO authenticated WITH CHECK (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can update staff salaries" ON public.staff_salaries FOR UPDATE TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can delete staff salaries" ON public.staff_salaries FOR DELETE TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));

-- staff_advances
DROP POLICY IF EXISTS "Users view own staff advances" ON public.staff_advances;
DROP POLICY IF EXISTS "Users insert own staff advances" ON public.staff_advances;
DROP POLICY IF EXISTS "Users update own staff advances" ON public.staff_advances;
DROP POLICY IF EXISTS "Users delete own staff advances" ON public.staff_advances;
CREATE POLICY "Gym team can view staff advances" ON public.staff_advances FOR SELECT TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can insert staff advances" ON public.staff_advances FOR INSERT TO authenticated WITH CHECK (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can update staff advances" ON public.staff_advances FOR UPDATE TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can delete staff advances" ON public.staff_advances FOR DELETE TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));

-- paid_training_members
DROP POLICY IF EXISTS "Users can view own paid training members" ON public.paid_training_members;
DROP POLICY IF EXISTS "Users can insert own paid training members" ON public.paid_training_members;
DROP POLICY IF EXISTS "Users can update own paid training members" ON public.paid_training_members;
DROP POLICY IF EXISTS "Users can delete own paid training members" ON public.paid_training_members;
CREATE POLICY "Gym team can view paid training" ON public.paid_training_members FOR SELECT TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can insert paid training" ON public.paid_training_members FOR INSERT TO authenticated WITH CHECK (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can update paid training" ON public.paid_training_members FOR UPDATE TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can delete paid training" ON public.paid_training_members FOR DELETE TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));

-- weight_progress
DROP POLICY IF EXISTS "Users can view own weight progress" ON public.weight_progress;
DROP POLICY IF EXISTS "Users can insert own weight progress" ON public.weight_progress;
DROP POLICY IF EXISTS "Users can delete own weight progress" ON public.weight_progress;
CREATE POLICY "Gym team can view weight progress" ON public.weight_progress FOR SELECT TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can insert weight progress" ON public.weight_progress FOR INSERT TO authenticated WITH CHECK (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can delete weight progress" ON public.weight_progress FOR DELETE TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));

-- body_measurements
DROP POLICY IF EXISTS "Users can view own measurements" ON public.body_measurements;
DROP POLICY IF EXISTS "Users can insert own measurements" ON public.body_measurements;
DROP POLICY IF EXISTS "Users can delete own measurements" ON public.body_measurements;
CREATE POLICY "Gym team can view measurements" ON public.body_measurements FOR SELECT TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can insert measurements" ON public.body_measurements FOR INSERT TO authenticated WITH CHECK (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can delete measurements" ON public.body_measurements FOR DELETE TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));

-- progress_photos
DROP POLICY IF EXISTS "Users can view own progress photos" ON public.progress_photos;
DROP POLICY IF EXISTS "Users can insert own progress photos" ON public.progress_photos;
DROP POLICY IF EXISTS "Users can delete own progress photos" ON public.progress_photos;
CREATE POLICY "Gym team can view photos" ON public.progress_photos FOR SELECT TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can insert photos" ON public.progress_photos FOR INSERT TO authenticated WITH CHECK (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can delete photos" ON public.progress_photos FOR DELETE TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));

-- workout_plans
DROP POLICY IF EXISTS "Users can view own workout plans" ON public.workout_plans;
DROP POLICY IF EXISTS "Users can insert own workout plans" ON public.workout_plans;
DROP POLICY IF EXISTS "Users can update own workout plans" ON public.workout_plans;
DROP POLICY IF EXISTS "Users can delete own workout plans" ON public.workout_plans;
CREATE POLICY "Gym team can view workout plans" ON public.workout_plans FOR SELECT TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can insert workout plans" ON public.workout_plans FOR INSERT TO authenticated WITH CHECK (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can update workout plans" ON public.workout_plans FOR UPDATE TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can delete workout plans" ON public.workout_plans FOR DELETE TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));

-- reminder_logs
DROP POLICY IF EXISTS "Users can view own reminder logs" ON public.reminder_logs;
DROP POLICY IF EXISTS "Users can insert own reminder logs" ON public.reminder_logs;
CREATE POLICY "Gym team can view reminder logs" ON public.reminder_logs FOR SELECT TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Gym team can insert reminder logs" ON public.reminder_logs FOR INSERT TO authenticated WITH CHECK (user_id = public.get_gym_owner_id(auth.uid()));

-- profiles (sub-users can read owner profile; only owner can update)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Gym team can view profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = public.get_gym_owner_id(auth.uid()));
CREATE POLICY "Owner can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Owner can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 5. Backfill 'owner' role for every existing gym owner
-- ============================================================
INSERT INTO public.user_roles (user_id, role)
SELECT g.user_id, 'owner'::public.app_role
FROM public.gyms g
WHERE g.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = g.user_id AND ur.role = 'owner'::public.app_role
  );
