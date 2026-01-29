-- Run this in Supabase SQL Editor to allow hierarchy 'chairman' (above executives).
-- The app uses chairman as the top level in the org chart and directory.

ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_hierarchy_check;
ALTER TABLE employees ADD CONSTRAINT employees_hierarchy_check
  CHECK (hierarchy IN ('chairman', 'executive', 'leader', 'member', 'hr'));
