import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Login accounts sign in to Supabase Auth with a synthetic address derived from the app user id. */
export function authEmailFor(appUserId: string): string {
  const local = appUserId.toLowerCase().replace(/[^a-z0-9._-]/g, '-');
  return `u-${local}@accounts.appraisals.app`;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Create the Auth user for an app account, or reset its password if a half-finished earlier attempt left one behind. */
export async function ensureAuthUser(
  admin: SupabaseClient,
  appUserId: string,
  password: string
): Promise<string> {
  const email = authEmailFor(appUserId);
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { app_user_id: appUserId },
  });
  if (!created.error && created.data.user) return created.data.user.id;

  const alreadyExists = created.error?.status === 422 || /already/i.test(created.error?.message ?? '');
  if (!alreadyExists) throw created.error;

  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email === email);
    if (match) {
      const updated = await admin.auth.admin.updateUserById(match.id, { password });
      if (updated.error) throw updated.error;
      return match.id;
    }
    if (data.users.length < 200) break;
  }
  throw created.error;
}

export const LOCKED_EMPLOYMENT_STATUSES = ['terminated', 'resigned'];
