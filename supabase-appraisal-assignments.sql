-- Appraisal Assignments table: syncs assignment forms so all users (admin + staff/exec) see the same data.
-- Run this in Supabase SQL Editor (Dashboard -> SQL Editor -> New query) if you use Supabase.
-- After running: deploy the app; the first device that had assignments (e.g. admin) will push them to Supabase on next load, then all devices will see the same list.

CREATE TABLE IF NOT EXISTS appraisal_assignments (
  id TEXT PRIMARY KEY,
  review_period_id TEXT NOT NULL,
  appraiser_id TEXT NOT NULL,
  appraiser_name TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN (
    'exec-to-leader', 'leader-to-member', 'member-to-leader', 'leader-to-leader', 'hr-to-all', 'custom'
  )),
  template_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'in-progress', 'completed')),
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('auto', 'manual')),
  link_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  due_date TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_appraisal_assignments_review_period ON appraisal_assignments(review_period_id);
CREATE INDEX IF NOT EXISTS idx_appraisal_assignments_appraiser ON appraisal_assignments(appraiser_id);

ALTER TABLE appraisal_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations" ON appraisal_assignments;
CREATE POLICY "Allow all operations" ON appraisal_assignments FOR ALL USING (true) WITH CHECK (true);
