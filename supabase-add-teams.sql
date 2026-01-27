-- Production schema fix: run in Supabase SQL Editor if you get
-- "Could not find the table 'public.teams'" or "Could not find the 'employee_id' column of 'users'"
-- Adds: teams table, team_id on employees, employee_id + must_change_password on users

-- 1. Users table: add columns required by the app (no-op if already present)
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;

-- 2. Teams table
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_teams_created ON teams(created_at);

-- 3. Employees: link to teams
ALTER TABLE employees ADD COLUMN IF NOT EXISTS team_id TEXT;

-- 4. RLS for teams
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations" ON teams;
CREATE POLICY "Allow all operations" ON teams FOR ALL USING (true) WITH CHECK (true);
