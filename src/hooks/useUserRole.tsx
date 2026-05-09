import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type GymRole = 'owner' | 'trainer' | 'receptionist' | 'admin';

export interface UserRoleInfo {
  role: GymRole;
  /** Owner account this user belongs to (= self for owner/admin) */
  gymOwnerId: string;
  /** Linked staff row for trainers, when present */
  staffId: string | null;
}

/**
 * Fetches the role + effective gym for the signed-in user.
 * Owners/admins return their own user_id as gymOwnerId.
 * Trainers/receptionists return the gym_users.gym_owner_id.
 */
export function useUserRole() {
  const { user } = useAuth();

  return useQuery<UserRoleInfo | null>({
    queryKey: ['user-role', user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      if (!user) return null;

      // Look up sub-user mapping first
      const { data: sub } = await supabase
        .from('gym_users')
        .select('gym_owner_id, role, staff_id, is_active')
        .eq('user_id', user.id)
        .maybeSingle();

      if (sub && sub.is_active) {
        return {
          role: sub.role as GymRole,
          gymOwnerId: sub.gym_owner_id,
          staffId: sub.staff_id ?? null,
        };
      }

      // Otherwise check user_roles for admin/owner
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const roleSet = new Set((roles ?? []).map(r => r.role));
      if (roleSet.has('admin')) {
        return { role: 'admin', gymOwnerId: user.id, staffId: null };
      }
      // default to owner (every gym account that isn't a sub-user is treated as owner)
      return { role: 'owner', gymOwnerId: user.id, staffId: null };
    },
  });
}

/** Pages each role can access (route paths). */
export const ROLE_ROUTES: Record<GymRole, string[]> = {
  admin: ['*'],
  owner: ['*'],
  trainer: ['/dashboard', '/paid-training', '/attendance', '/profile'],
  receptionist: ['/dashboard', '/members', '/attendance', '/fees', '/profile'],
};

export function canAccess(role: GymRole | undefined, path: string): boolean {
  if (!role) return false;
  const allowed = ROLE_ROUTES[role];
  if (allowed.includes('*')) return true;
  return allowed.some(p => path === p || path.startsWith(p + '/'));
}
