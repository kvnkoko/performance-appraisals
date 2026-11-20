// Admin-only management of login accounts (create, edit, reset password, delete).
// Password hashes and Supabase Auth users are only ever touched here, never from the browser.
import { corsHeaders, ensureAuthUser, json, serviceClient } from '../_shared/common.ts';

const USER_COLUMNS =
  'id, username, name, email, role, active, created_at, last_login_at, employee_id, must_change_password, auth_user_id';

interface UserInput {
  id: string;
  username: string;
  name: string;
  email?: string | null;
  role: 'admin' | 'staff';
  active?: boolean;
  employeeId?: string | null;
  mustChangePassword?: boolean;
  createdAt?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const admin = serviceClient();

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: authData } = await admin.auth.getUser(jwt);
  if (!authData?.user) return json({ error: 'not_signed_in', message: 'Please sign in again.' }, 401);
  const { data: caller } = await admin
    .from('users')
    .select('id, role, active')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle();
  if (!caller || caller.active === false || caller.role !== 'admin') {
    return json({ error: 'forbidden', message: 'Only administrators can manage accounts.' }, 403);
  }

  let body: { action?: string; user?: UserInput; password?: string; legacyPasswordHash?: string; id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  try {
    if (body.action === 'save' && body.user) {
      return await saveUser(admin, caller.id, body.user, body.password, body.legacyPasswordHash);
    }
    if (body.action === 'delete' && body.id) {
      return await deleteUser(admin, caller.id, body.id);
    }
    return json({ error: 'bad_request' }, 400);
  } catch (e) {
    console.error('admin-users failed', e);
    const message = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
    return json({ error: 'server_error', message }, 500);
  }
});

async function countOtherActiveAdmins(admin: ReturnType<typeof serviceClient>, excludeId: string): Promise<number> {
  const { count, error } = await admin
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin')
    .neq('active', false)
    .neq('id', excludeId);
  if (error) throw error;
  return count ?? 0;
}

async function saveUser(
  admin: ReturnType<typeof serviceClient>,
  callerId: string,
  input: UserInput,
  password: string | undefined,
  legacyPasswordHash: string | undefined
): Promise<Response> {
  const username = String(input.username ?? '').trim().toLowerCase();
  if (!input.id || !username || !input.name) {
    return json({ error: 'bad_request', message: 'Username and name are required.' }, 400);
  }
  if (password !== undefined && password.length < 6) {
    return json({ error: 'weak_password', message: 'Password must be at least 6 characters.' }, 400);
  }

  const { data: existing, error: readError } = await admin
    .from('users')
    .select('id, role, active, auth_user_id')
    .eq('id', input.id)
    .maybeSingle();
  if (readError) throw readError;

  const active = input.active !== false;
  const losesAdmin = existing && existing.role === 'admin' && existing.active !== false && (input.role !== 'admin' || !active);
  if (losesAdmin && (await countOtherActiveAdmins(admin, input.id)) === 0) {
    return json({ error: 'last_admin', message: 'This is the only active administrator account. Make someone else an admin first.' }, 409);
  }
  if (existing && existing.id === callerId && losesAdmin) {
    return json({ error: 'self_demote', message: 'You cannot remove your own admin access. Ask another administrator.' }, 409);
  }

  const row: Record<string, unknown> = {
    id: input.id,
    username,
    name: input.name,
    email: input.email || null,
    role: input.role === 'admin' ? 'admin' : 'staff',
    active,
    employee_id: input.employeeId || null,
    must_change_password: input.mustChangePassword ?? false,
  };

  if (!existing) {
    if (!password && !legacyPasswordHash) {
      return json({ error: 'bad_request', message: 'A password is required for new accounts.' }, 400);
    }
    row.created_at = input.createdAt || new Date().toISOString();
    row.password_hash = legacyPasswordHash && !password ? legacyPasswordHash : '!supabase-auth';
    const { error } = await admin.from('users').insert(row);
    if (error) return dbError(error);
  } else {
    const { error } = await admin.from('users').update(row).eq('id', input.id);
    if (error) return dbError(error);
  }

  if (password) {
    let authUserId: string | null = existing?.auth_user_id ?? null;
    if (authUserId) {
      const { error } = await admin.auth.admin.updateUserById(authUserId, { password });
      if (error) authUserId = null;
    }
    if (!authUserId) authUserId = await ensureAuthUser(admin, input.id, password);
    const { error } = await admin
      .from('users')
      .update({ auth_user_id: authUserId, password_hash: '!supabase-auth' })
      .eq('id', input.id);
    if (error) throw error;
  }

  if (!active && existing?.auth_user_id) {
    // Sign the account out everywhere; their refresh tokens stop working.
    await admin.auth.admin.signOut(existing.auth_user_id, 'global').catch(() => {});
  }

  const { data: saved, error } = await admin.from('users').select(USER_COLUMNS).eq('id', input.id).single();
  if (error) throw error;
  return json({ user: saved });
}

async function deleteUser(admin: ReturnType<typeof serviceClient>, callerId: string, id: string): Promise<Response> {
  if (id === callerId) {
    return json({ error: 'self_delete', message: 'You cannot delete your own account.' }, 409);
  }
  const { data: existing, error: readError } = await admin
    .from('users')
    .select('id, role, active, auth_user_id')
    .eq('id', id)
    .maybeSingle();
  if (readError) throw readError;
  if (!existing) return json({ ok: true });

  if (existing.role === 'admin' && existing.active !== false && (await countOtherActiveAdmins(admin, id)) === 0) {
    return json({ error: 'last_admin', message: 'This is the only active administrator account.' }, 409);
  }

  const { error } = await admin.from('users').delete().eq('id', id);
  if (error) throw error;
  if (existing.auth_user_id) {
    const { error: authError } = await admin.auth.admin.deleteUser(existing.auth_user_id);
    if (authError) console.error('Auth user delete failed', authError);
  }
  return json({ ok: true });
}

function dbError(error: { code?: string; message?: string }): Response {
  if (error.code === '23505') {
    return json({ error: 'username_taken', message: 'That username is already taken.' }, 409);
  }
  return json({ error: 'server_error', message: error.message ?? 'Database error' }, 500);
}
