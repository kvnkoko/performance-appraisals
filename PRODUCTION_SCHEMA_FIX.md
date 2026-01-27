# Production schema fix (Supabase)

If you see **"Could not find the 'employee_id' column of 'users'"** or **"Could not find the table 'public.teams'"** on Vercel or in production:

1. Open **Supabase Dashboard** → your project → **SQL Editor** → **New query**.
2. Copy the contents of **`supabase-add-teams.sql`** into the editor.
3. Click **Run** (or Cmd/Ctrl + Enter).

That script adds:

- `users.employee_id` and `users.must_change_password` (so user saves succeed)
- `teams` table and `employees.team_id` (so teams load and employees can link to teams)

After it runs, redeploy or refresh the app; employee and user creation should persist to Supabase.
