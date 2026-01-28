-- Optional: run when using Supabase, to allow HR hierarchy and hr-to-all template/assignment types.
-- The app validates values; these changes allow new enum-like values.

-- Employees: allow hierarchy 'hr'
-- If hierarchy is an enum, add the new value or change to text, e.g.:
-- ALTER TABLE employees ALTER COLUMN hierarchy TYPE text;
-- No CHECK constraint required; app validates: 'executive' | 'leader' | 'member' | 'hr'

-- Templates: allow type 'hr-to-all'
-- ALTER TABLE templates ALTER COLUMN type TYPE text;
-- App validates template types including 'hr-to-all'

-- Appraisal assignments: allow relationship_type 'hr-to-all'
-- If you have an appraisal_assignments table:
-- ALTER TABLE appraisal_assignments ALTER COLUMN relationship_type TYPE text;
-- App validates: 'exec-to-leader' | 'leader-to-member' | 'member-to-leader' | 'leader-to-leader' | 'hr-to-all' | 'custom'

-- Optional settings columns for HR score weight (if you persist company settings in Supabase):
-- ALTER TABLE settings ADD COLUMN IF NOT EXISTS hr_score_weight integer DEFAULT 30;
-- ALTER TABLE settings ADD COLUMN IF NOT EXISTS require_hr_for_ranking boolean DEFAULT false;
-- Then update getSettingsFromSupabase/saveSettingsToSupabase to read/write these columns.
