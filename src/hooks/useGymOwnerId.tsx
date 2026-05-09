import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';

/**
 * Returns the effective `user_id` for gym-scoped queries.
 * - Owners/Admins: their own auth id
 * - Trainers/Receptionists: their owner's id (so they see the shared gym data)
 */
export function useGymOwnerId(): string | null {
  const { user } = useAuth();
  const { data: roleInfo } = useUserRole();
  return roleInfo?.gymOwnerId ?? user?.id ?? null;
}
