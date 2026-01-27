-- Production schema fix: run in Supabase SQL Editor if you get
-- "Could not find the table 'public.teams'", "Could not find the 'employee_id' column of 'users'",
-- or employees not appearing after creation.
-- Adds: users.employee_id, users.must_change_password, employees table (if missing), teams, employees.team_id

-- 1. Users table: add columns required by the app (no-op if already present)
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;

-- 2. Employees table (create if missing — e.g. when only users was set up)
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL,
  hierarchy TEXT NOT NULL CHECK (hierarchy IN ('executive', 'leader', 'member')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_employees_hierarchy ON employees(hierarchy);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS team_id TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS reports_to TEXT;

-- 3. Teams table
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_teams_created ON teams(created_at);

-- 4. RLS for teams and employees (employees needed if table was just created)
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations" ON teams;
CREATE POLICY "Allow all operations" ON teams FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations" ON employees;
CREATE POLICY "Allow all operations" ON employees FOR ALL USING (true) WITH CHECK (true);
