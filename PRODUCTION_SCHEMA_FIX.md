# Production schema fix (Supabase)

If you see **"Could not find the 'employee_id' column of 'users'"**, **"Could not find the table 'public.teams'"**, or **employees not appearing after creation** on Vercel or in production:

1. Open **Supabase Dashboard** → your project → **SQL Editor** → **New query**.
2. Copy the contents of **`supabase-add-teams.sql`** into the editor.
3. Click **Run** (or Cmd/Ctrl + Enter).

That script adds or fixes:

- `users.employee_id` and `users.must_change_password` (so user saves succeed)
- `employees` table (if missing) and `employees.team_id` (so employee creation persists to Supabase)
- `teams` table and RLS for teams and employees

After it runs, redeploy or refresh the app; employee and user creation should persist and sync across devices.
