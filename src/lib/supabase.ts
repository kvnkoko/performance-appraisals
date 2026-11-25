import type { User } from '@/types';
import { assertWritable, isReadOnlyMode } from '@/lib/read-only-mode';

// Lazy load Supabase to avoid build errors if package not installed
let supabaseClient: any = null;
let supabaseModule: any = null;

export async function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  
  try {
    if (!supabaseModule) {
      supabaseModule = await import('@supabase/supabase-js');
    }
    
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    
    if (supabaseUrl && supabaseAnonKey) {
      supabaseClient = guardWrites(
        supabaseModule.createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
          },
        })
      );
      return supabaseClient;
    }
  } catch (error) {
    console.warn('Supabase package not available:', error);
  }
  
  return null;
}

/** Database functions that only read (or record "View as" itself) and may run in read-only mode. */
const READ_ONLY_RPCS = new Set([
  'get_link_form',
  'app_user_id',
  'app_employee_id',
  'app_is_admin',
  'log_view_as',
  'get_period_rankings',
  'get_my_results',
]);

/** Refuse table writes and data-changing database functions while "View as" is on. */
function guardWrites(client: any) {
  const from = client.from.bind(client);
  client.from = (table: string) => {
    const builder = from(table);
    for (const method of ['insert', 'update', 'upsert', 'delete']) {
      const original = builder[method].bind(builder);
      builder[method] = (...args: unknown[]) => {
        assertWritable();
        return original(...args);
      };
    }
    return builder;
  };
  const rpc = client.rpc.bind(client);
  client.rpc = (fn: string, ...args: unknown[]) => {
    if (!READ_ONLY_RPCS.has(fn)) assertWritable();
    return rpc(fn, ...args);
  };
  return client;
}

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Database table names
export const TABLES = {
  USERS: 'users',
  SETTINGS: 'settings',
} as const;

/** Password hashes are never selected; the database does not let the browser read them. */
const USER_COLUMNS =
  'id, username, name, email, role, active, created_at, last_login_at, employee_id, must_change_password, auth_user_id';

async function requireClient() {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('Supabase not configured');
  const supabase = await getSupabaseClient();
  if (!supabase) throw new Error('Supabase client not available');
  return supabase;
}

/** Error from an Edge Function, carrying the user-facing message the function returned. */
export class FunctionCallError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'FunctionCallError';
    this.code = code;
    this.status = status;
  }
}

export async function callFunction<T>(name: string, body: unknown): Promise<T> {
  if (name !== 'auth-resolve') assertWritable();
  const supabase = await requireClient();
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let code = 'server_error';
    let message = 'Something went wrong. Please try again.';
    let status = 500;
    const response: Response | undefined = error.context;
    if (response && typeof response.json === 'function') {
      status = response.status;
      try {
        const payload = await response.json();
        code = payload?.error ?? code;
        message = payload?.message ?? message;
      } catch {
        // non-JSON error body
      }
    }
    throw new FunctionCallError(code, message, status);
  }
  return data as T;
}

// User management functions using Supabase
export async function getUsersFromSupabase(): Promise<User[]> {
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from(TABLES.USERS)
    .select(USER_COLUMNS)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching users from Supabase:', error);
    throw error;
  }

  return (data || []).map(mapUser);
}

export function mapUser(user: any): User {
  return {
    id: user.id,
    username: user.username,
    passwordHash: '',
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    employeeId: user.employee_id,
    mustChangePassword: user.must_change_password,
    createdAt: user.created_at,
    lastLoginAt: user.last_login_at,
  };
}

export async function getUserByUsernameFromSupabase(username: string): Promise<User | undefined> {
  const supabase = await requireClient();
  const normalized = username.trim().toLowerCase();
  const { data, error } = await supabase
    .from(TABLES.USERS)
    .select(USER_COLUMNS)
    .eq('username', normalized)
    .maybeSingle();

  if (error) {
    console.error('Error fetching user from Supabase:', error);
    throw error;
  }
  return data ? mapUser(data) : undefined;
}

export async function getUserFromSupabase(id: string): Promise<User | undefined> {
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from(TABLES.USERS)
    .select(USER_COLUMNS)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching user from Supabase:', error);
    throw error;
  }
  return data ? mapUser(data) : undefined;
}

/** The signed-in person's own account row. */
export async function getMyUserFromSupabase(): Promise<User | undefined> {
  const supabase = await requireClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const authUserId = sessionData?.session?.user?.id;
  if (!authUserId) return undefined;
  const { data, error } = await supabase
    .from(TABLES.USERS)
    .select(USER_COLUMNS)
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapUser(data) : undefined;
}

export interface SaveUserOptions {
  /** New plain-text password. Only sent to the admin-users function, which stores it in Supabase Auth. */
  password?: string;
  /** Legacy SHA-256 hash (backup import); the account moves to Supabase Auth on its next sign-in. */
  legacyPasswordHash?: string;
}

export async function saveUserToSupabase(user: User, options: SaveUserOptions = {}): Promise<User> {
  const result = await callFunction<{ user: any }>('admin-users', {
    action: 'save',
    user: {
      id: user.id,
      username: user.username.toLowerCase(),
      name: user.name,
      email: user.email || null,
      role: user.role,
      active: user.active !== undefined ? user.active : true,
      employeeId: user.employeeId || null,
      mustChangePassword: user.mustChangePassword || false,
      createdAt: user.createdAt,
    },
    password: options.password,
    legacyPasswordHash: options.legacyPasswordHash,
  });
  return mapUser(result.user);
}

/** Create a person and their sign-in in one step (admin-users server function). */
export async function createPersonInSupabase(
  employeeRow: Record<string, unknown>,
  login: User,
  password: string
): Promise<User> {
  const result = await callFunction<{ user: any }>('admin-users', {
    action: 'create_person',
    employee: employeeRow,
    user: { id: login.id, username: login.username.toLowerCase(), name: login.name, role: login.role, mustChangePassword: true },
    password,
  });
  return mapUser(result.user);
}

export async function deletePersonFromSupabase(employeeId: string): Promise<void> {
  await callFunction('admin-users', { action: 'delete_person', id: employeeId });
}

/** Change the signed-in person's username and email. Throws an Error with a user-facing message. */
export async function updateMyAccount(username: string, email: string): Promise<void> {
  const supabase = await requireClient();
  const { error } = await supabase.rpc('update_my_account', { p_username: username, p_email: email });
  if (error) throw new Error(error.message || 'Could not update your account.');
}

/** Change the signed-in person's password after re-checking the current one. */
export async function changeMyPassword(currentPassword: string, newPassword: string): Promise<'ok' | 'wrong_current'> {
  assertWritable();
  const supabase = await requireClient();
  const { data } = await supabase.auth.getSession();
  const email = data?.session?.user?.email;
  if (!email) throw new Error('Please sign in again.');
  const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
  if (verifyError) {
    if (verifyError.status === 400) return 'wrong_current';
    throw verifyError;
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    if (/different from the old password/i.test(error.message ?? '')) {
      throw new Error('Please choose a password different from your current one.');
    }
    throw error;
  }
  return 'ok';
}

export async function recordLogin(): Promise<void> {
  if (isReadOnlyMode()) return;
  try {
    const supabase = await requireClient();
    await supabase.rpc('record_login');
  } catch (error) {
    console.warn('Could not record login time:', error);
  }
}

// Check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}

// One-time diagnostic: redacted project hint (hostname only) for debugging "0 users" across devices
export function getSupabaseProjectHint(): string {
  const u = import.meta.env.VITE_SUPABASE_URL || '';
  try {
    return u ? new URL(u).hostname : '(not set)';
  } catch {
    return '(invalid url)';
  }
}
