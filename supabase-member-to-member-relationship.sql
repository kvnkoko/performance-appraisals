-- Add 'member-to-member' to allowed relationship_type for appraisal_assignments.
-- Run in Supabase SQL Editor if you use Supabase. Constraint name may vary; if this fails, run:
--   SELECT conname FROM pg_constraint WHERE conrelid = 'appraisal_assignments'::regclass AND contype = 'c';
-- then DROP CONSTRAINT <name> and ADD the new CHECK below.

ALTER TABLE appraisal_assignments
  DROP CONSTRAINT IF EXISTS appraisal_assignments_relationship_type_check;

ALTER TABLE appraisal_assignments
  ADD CONSTRAINT appraisal_assignments_relationship_type_check
  CHECK (relationship_type IN (
    'exec-to-leader', 'leader-to-member', 'member-to-leader', 'leader-to-leader', 'member-to-member', 'hr-to-all', 'custom'
  ));
