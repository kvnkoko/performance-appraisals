// Turns a username into the Supabase Auth sign-in address. On an account's first sign-in after the
// move to Supabase Auth, it checks the legacy password hash and creates the Auth user, so existing
// passwords keep working. The browser then signs in with supabase.auth.signInWithPassword, which is
// where the password is checked (and rate limited) for accounts that have already moved.
//
// Unknown usernames get a made-up address in the same format, so this endpoint cannot be used to
// find out which usernames exist; the sign-in that follows simply fails.
import {
  authEmailFor,
  corsHeaders,
  ensureAuthUser,
  json,
  LOCKED_EMPLOYMENT_STATUSES,
  serviceClient,
  sha256Hex,
} from '../_shared/common.ts';

const INVALID = { error: 'invalid_credentials', message: 'Username or password is incorrect.' };
const DISABLED = { error: 'account_disabled', message: 'Your account has been disabled. Please contact an administrator.' };

/** Looks like a real account id (13-digit timestamp + 9 characters), derived from the username. */
async function decoyEmail(username: string): Promise<string> {
  const hex = await sha256Hex(`decoy:${username}`);
  const digits = (BigInt('0x' + hex.slice(0, 12)) % 100000000000n).toString().padStart(11, '0');
  return authEmailFor(`17${digits}-${hex.slice(12, 21)}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let username = '';
  let password = '';
  try {
    const body = await req.json();
    username = String(body?.username ?? '').trim().toLowerCase();
    password = String(body?.password ?? '');
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (!username || !password) return json(INVALID, 401);

  const admin = serviceClient();
  const { data: user, error } = await admin
    .from('users')
    .select('id, password_hash, active, auth_user_id, employee_id')
    .eq('username', username)
    .maybeSingle();
  if (error) {
    console.error('auth-resolve lookup failed', error);
    return json({ error: 'server_error' }, 500);
  }
  if (!user) return json({ email: await decoyEmail(username) });

  // Already on Supabase Auth: the password check happens in signInWithPassword. Disabled accounts
  // are refused after that check (the database denies them all data either way).
  if (user.auth_user_id) return json({ email: authEmailFor(user.id) });

  // First sign-in since the move: check the legacy hash here.
  if ((await sha256Hex(password)) !== user.password_hash) return json({ email: authEmailFor(user.id) });

  if (user.active === false) return json(DISABLED, 403);
  if (user.employee_id) {
    const { data: employee } = await admin
      .from('employees')
      .select('employment_status')
      .eq('id', user.employee_id)
      .maybeSingle();
    if (!employee || LOCKED_EMPLOYMENT_STATUSES.includes(employee.employment_status ?? '')) {
      return json(DISABLED, 403);
    }
  }

  try {
    const authUserId = await ensureAuthUser(admin, user.id, password);
    const { error: linkError } = await admin
      .from('users')
      .update({ auth_user_id: authUserId, password_hash: '!supabase-auth' })
      .eq('id', user.id);
    if (linkError) throw linkError;
  } catch (e) {
    console.error('auth-resolve migration failed', e);
    return json({ error: 'server_error', message: 'Could not finish setting up your account. Please try again.' }, 500);
  }

  return json({ email: authEmailFor(user.id) });
});
