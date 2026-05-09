import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const inputSchema = z.object({
  email: z.string().trim().email('Invalid email').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
  full_name: z.string().trim().min(1, 'Name is required').max(120),
  role: z.enum(['trainer', 'receptionist'], { errorMap: () => ({ message: 'Role must be trainer or receptionist' }) }),
  staff_id: z.string().uuid().nullable().optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }

    // Identify caller
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerError } = await userClient.auth.getUser();
    if (callerError || !caller) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    // Caller must be the gym owner (i.e. NOT a sub-user themselves) AND have a gym record OR be platform admin.
    const { data: subRecord } = await admin
      .from('gym_users')
      .select('id')
      .eq('user_id', caller.id)
      .maybeSingle();
    if (subRecord) return json({ error: 'Only the gym owner can manage team users' }, 403);

    // Make sure caller is owner of a gym (or platform admin)
    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .in('role', ['owner', 'admin'])
      .maybeSingle();
    if (!roleRow) {
      // Self-heal: if they own a gym but role missing, grant owner role.
      const { data: gym } = await admin.from('gyms').select('id').eq('user_id', caller.id).maybeSingle();
      if (!gym) return json({ error: 'Owner access required' }, 403);
      await admin.from('user_roles').insert({ user_id: caller.id, role: 'owner' });
    }

    // Validate input
    const raw = await req.json();
    const parsed = inputSchema.safeParse(raw);
    if (!parsed.success) {
      return json({ error: parsed.error.errors.map(e => e.message).join(', ') }, 400);
    }
    const { email, password, full_name, role, staff_id } = parsed.data;

    // Create auth user
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role, gym_owner_id: caller.id },
    });
    if (createErr || !created.user) {
      return json({ error: createErr?.message || 'Failed to create user' }, 400);
    }
    const newUserId = created.user.id;

    // Insert gym_users mapping
    const { error: mapErr } = await admin.from('gym_users').insert({
      user_id: newUserId,
      gym_owner_id: caller.id,
      role,
      staff_id: staff_id || null,
      full_name,
      email,
    });
    if (mapErr) {
      await admin.auth.admin.deleteUser(newUserId);
      return json({ error: mapErr.message }, 400);
    }

    // Insert role row
    await admin.from('user_roles').insert({ user_id: newUserId, role });

    return json({ success: true, user_id: newUserId }, 200);
  } catch (e) {
    console.error('create-sub-user error', e);
    return json({ error: 'Internal server error' }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
