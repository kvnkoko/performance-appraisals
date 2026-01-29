-- Organization chart overhaul: run in Supabase SQL Editor.
-- Adds: executive_type, allows hierarchy 'department-leader', optional updated_at.

-- Allow 'department-leader' in hierarchy (in addition to existing values)
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_hierarchy_check;
ALTER TABLE employees ADD CONSTRAINT employees_hierarchy_check
  CHECK (hierarchy IN ('chairman', 'executive', 'leader', 'department-leader', 'member', 'hr'));

-- Executive type: 'operational' (manages dept) or 'advisory' (no dept)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS executive_type TEXT
  CHECK (executive_type IS NULL OR executive_type IN ('operational', 'advisory'));

-- Optional: updated_at for employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Optional: teams.oversight_executive_id, teams.leader_ids (JSONB array of employee IDs)
ALTER TABLE teams ADD COLUMN IF NOT EXISTS oversight_executive_id TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS leader_ids JSONB DEFAULT '[]';
