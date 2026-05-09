import { supabase } from '@/integrations/supabase/client';

interface LogParams {
  action_type: string;
  description?: string;
  page?: string;
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, unknown>;
}

/** Cache resolved gym/role per session to avoid repeated lookups. */
let cache: { userId: string; gymOwnerId: string; role: string; userName: string | null; userEmail: string | null } | null = null;

async function resolveContext() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  if (cache && cache.userId === user.id) return cache;

  let gymOwnerId = user.id;
  let role = 'owner';
  let userName: string | null = (user.user_metadata?.full_name as string) || null;

  const { data: sub } = await supabase
    .from('gym_users')
    .select('gym_owner_id, role, full_name')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (sub) {
    gymOwnerId = sub.gym_owner_id;
    role = sub.role;
    userName = sub.full_name || userName;
  } else {
    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
    if (roles?.some(r => r.role === 'admin')) role = 'admin';
  }

  cache = { userId: user.id, gymOwnerId, role, userName, userEmail: user.email ?? null };
  return cache;
}

export function clearActivityLogCache() { cache = null; }

export async function logActivity(params: LogParams) {
  try {
    const ctx = await resolveContext();
    if (!ctx) return;
    await supabase.from('activity_logs').insert([{
      gym_owner_id: ctx.gymOwnerId,
      user_id: ctx.userId,
      user_name: ctx.userName || ctx.userEmail || 'Unknown',
      user_role: ctx.role,
      action_type: params.action_type,
      description: params.description ?? null,
      page: params.page ?? (typeof window !== 'undefined' ? window.location.pathname : null),
      entity_type: params.entity_type ?? null,
      entity_id: params.entity_id ?? null,
      metadata: (params.metadata ?? null) as any,
    }]);
  } catch (e) {
    console.warn('activity log failed', e);
  }
}
