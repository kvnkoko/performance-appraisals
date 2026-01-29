-- Add employment status to employees table.
-- When status is 'terminated' or 'resigned', linked user accounts are locked (active = false) and sessions invalidated.

ALTER TABLE employees ADD COLUMN IF NOT EXISTS employment_status TEXT DEFAULT 'permanent';

-- Optional: enforce valid values (uncomment if you want strict validation)
-- ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_employment_status_check;
-- ALTER TABLE employees ADD CONSTRAINT employees_employment_status_check
--   CHECK (employment_status IN ('permanent', 'temporary', 'contractor', 'probation', 'intern', 'on-leave', 'terminated', 'resigned'));
