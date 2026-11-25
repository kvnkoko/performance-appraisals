// Admin-only management of people and their sign-ins: create a person with their login, edit a
// login (username, admin access, locked, password reset), and delete a person with their login.
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

  let body: {
    action?: string;
    user?: UserInput;
    employee?: Record<string, unknown>;
    password?: string;
    legacyPasswordHash?: string;
    id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  try {
    if (body.action === 'save' && body.user) {
      return await saveUser(admin, caller.id, body.user, body.password, body.legacyPasswordHash);
    }
    if (body.action === 'create_person' && body.employee && body.user) {
      return await createPerson(admin, caller.id, body.employee, body.user, body.password);
    }
    if (body.action === 'delete_person' && body.id) {
      return await deletePerson(admin, caller.id, body.id);
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

/** Creates the person and their login in one database transaction, then their Supabase Auth user. */
async function createPerson(
  admin: ReturnType<typeof serviceClient>,
  callerId: string,
  employee: Record<string, unknown>,
  login: UserInput,
  password: string | undefined
): Promise<Response> {
  const username = String(login.username ?? '').trim().toLowerCase();
  if (!login.id || !employee.id || !username || !String(employee.name ?? '').trim()) {
    return json({ error: 'bad_request', message: 'Name and username are required.' }, 400);
  }
  if (!password || password.length < 6) {
    return json({ error: 'weak_password', message: 'Password must be at least 6 characters.' }, 400);
  }

  const { error: createError } = await admin.rpc('admin_create_person', {
    p_actor: callerId,
    p_employee: employee,
    p_login: { id: login.id, username, role: login.role, mustChangePassword: login.mustChangePassword ?? true },
  });
  if (createError) return dbError(createError);

  try {
    const authUserId = await ensureAuthUser(admin, login.id, password);
    const { error } = await admin.from('users').update({ auth_user_id: authUserId }).eq('id', login.id);
    if (error) throw error;
  } catch (e) {
    console.error('create_person: auth setup failed, undoing', e);
    await admin.rpc('admin_delete_person', { p_actor: callerId, p_employee_id: employee.id });
    throw e;
  }

  const { data: saved, error } = await admin.from('users').select(USER_COLUMNS).eq('id', login.id).single();
  if (error) throw error;
  return json({ user: saved });
}

/** Deletes a person who has no submitted appraisals, together with their login and Auth user. */
async function deletePerson(admin: ReturnType<typeof serviceClient>, callerId: string, employeeId: string): Promise<Response> {
  const { data: authUserId, error } = await admin.rpc('admin_delete_person', {
    p_actor: callerId,
    p_employee_id: employeeId,
  });
  if (error) return dbError(error);
  if (authUserId) {
    const { error: authError } = await admin.auth.admin.deleteUser(String(authUserId));
    if (authError) console.error('Auth user delete failed', authError);
  }
  return json({ ok: true });
}

function dbError(error: { code?: string; message?: string }): Response {
  const message = error.message ?? '';
  if (error.code === '23505' && /employee_id/.test(message)) {
    return json({ error: 'has_login', message: 'This person already has a sign-in.' }, 409);
  }
  if (error.code === '23505') {
    return json({ error: 'username_taken', message: 'That username is already taken.' }, 409);
  }
  if (error.code === '23514' && /users_active_needs_person/.test(message)) {
    return json({ error: 'needs_person', message: 'A sign-in must belong to a person before it can be active.' }, 409);
  }
  if (error.code === '23503') {
    return json({ error: 'unknown_person', message: 'That person no longer exists.' }, 409);
  }
  if (error.code === 'P0001' || error.code === '22023') {
    return json({ error: 'refused', message }, 409);
  }
  return json({ error: 'server_error', message: message || 'Database error' }, 500);
}
