-- Run this in Supabase SQL Editor to fix: "employees_hierarchy_check" violation when saving HR employees.
-- The app allows hierarchy 'hr'; the database constraint must include it.

-- 1. Employees: allow hierarchy 'hr' (drop old check, add new one)
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_hierarchy_check;
ALTER TABLE employees ADD CONSTRAINT employees_hierarchy_check
  CHECK (hierarchy IN ('executive', 'leader', 'member', 'hr'));

-- Optional: if you use templates and appraisal_assignments tables and get similar errors for 'hr-to-all':
-- Templates: allow type 'hr-to-all'
-- ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_type_check;
-- ALTER TABLE templates ADD CONSTRAINT templates_type_check
--   CHECK (type IN ('executives-to-leaders', 'leaders-to-members', 'members-to-leaders', 'leaders-to-leaders', 'members-to-members', 'hr-to-all'));

-- Appraisal assignments: allow relationship_type 'hr-to-all' (constraint name may vary)
-- ALTER TABLE appraisal_assignments DROP CONSTRAINT IF EXISTS appraisal_assignments_relationship_type_check;
-- ALTER TABLE appraisal_assignments ADD CONSTRAINT appraisal_assignments_relationship_type_check
--   CHECK (relationship_type IN ('exec-to-leader', 'leader-to-member', 'member-to-leader', 'leader-to-leader', 'hr-to-all', 'custom'));
