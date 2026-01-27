# Supabase Cross-Device Sync Checklist

If users created on one computer cannot sign in on another, or you see "getUsers: Found 0 users in Supabase" in the console, use this checklist.

## Same project everywhere

The device where you create users and the Vercel deployment must use the **same** Supabase project.

- **Vercel:** Project → Settings → Environment Variables. Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` match the project where you create users.
- **Local:** `.env.local` (or equivalent) must have the same `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the app where you create users.
- After changing env vars in Vercel, **trigger a new build** (redeploy or push a commit). Vite bakes env vars in at build time.

## RLS on `users`

If Row Level Security (RLS) on the `users` table blocks the anon key from reading, the client will always see 0 rows.

- In **Supabase Dashboard:** Table Editor → `users` → RLS (or Authentication → Policies).
- Ensure there is a policy that allows the anon key to **SELECT** rows, e.g.:
  - “Allow all” style: `USING (true)` / `WITH CHECK (true)`, or
  - `CREATE POLICY "Allow anon read users" ON users FOR SELECT USING (true);`
- If there is no such policy, add one so the app can read users for login and user lists.

## User created with Supabase on

When you create a user on the other computer, that app must have had Supabase env vars set for the **same** project. If it did not, the user was only written to that browser’s IndexedDB and will never appear in Supabase or on other devices.

- Create users only when the app is running with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set to the shared project.
- If you created users before configuring Supabase, create them again (or run a migration/seed) so they exist in Supabase.

## Verify in Supabase

- In **Supabase Dashboard:** Table Editor → `users`.
- Confirm the expected rows exist (e.g. the usernames you use to sign in).
- If the table is empty there, the fix is data/setup (create users again with Supabase configured, or run migration/seed), not app code.

## One-time diagnostic in the app

On first load, the app logs once to the console:  
`Supabase: configured, users count = N (project-hostname)`  
Use this to confirm (1) Supabase is configured and (2) how many users that project returns. If the hostname does not match your Supabase project URL, the deployment is using a different project or wrong env vars.
