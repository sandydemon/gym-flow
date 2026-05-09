-- 1. Extend role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'owner';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'trainer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'receptionist';
