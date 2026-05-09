import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const schema = z.object({
  user_id: z.string().uuid(),
  // Optional: new password to reset for the team member
  new_password: z.string().min(6).max(128).optional(),
  // Optional: deactivate instead of full delete
  action: z.enum(['delete', 'reset_password', 'set_active']).default('delete'),
  is_active: z.boolean().optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    const raw = await req.json();
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return json({ error: parsed.error.errors.map(e => e.message).join(', ') }, 400);

    // Verify the target sub-user belongs to caller (the gym owner)
    const { data: target } = await admin
      .from('gym_users')
      .select('id, user_id, gym_owner_id')
      .eq('user_id', parsed.data.user_id)
      .maybeSingle();
    if (!target || target.gym_owner_id !== caller.id) {
      return json({ error: 'Not allowed' }, 403);
    }

    if (parsed.data.action === 'delete') {
      await admin.from('user_roles').delete().eq('user_id', target.user_id);
      await admin.from('gym_users').delete().eq('user_id', target.user_id);
      await admin.auth.admin.deleteUser(target.user_id);
    } else if (parsed.data.action === 'reset_password') {
      if (!parsed.data.new_password) return json({ error: 'Password required' }, 400);
      const { error } = await admin.auth.admin.updateUserById(target.user_id, { password: parsed.data.new_password });
      if (error) return json({ error: error.message }, 400);
    } else if (parsed.data.action === 'set_active') {
      if (parsed.data.is_active === undefined) return json({ error: 'is_active required' }, 400);
      await admin.from('gym_users').update({ is_active: parsed.data.is_active }).eq('user_id', target.user_id);
    }

    return json({ success: true }, 200);
  } catch (e) {
    console.error('manage-sub-user error', e);
    return json({ error: 'Internal server error' }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
