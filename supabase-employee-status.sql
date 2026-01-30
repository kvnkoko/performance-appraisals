-- Add employment_status to employees table.
-- Run in Supabase SQL Editor. Safe to run multiple times (idempotent).
-- Fixes: "employment_status could not be set" / column does not exist when saving employees.

-- 1. Add column (no-op if already present)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employment_status TEXT DEFAULT 'permanent';

-- 2. Optional: constrain to allowed values (matches app EmploymentStatus type)
-- Uncomment below if you want DB-level validation:
-- ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_employment_status_check;
-- ALTER TABLE employees ADD CONSTRAINT employees_employment_status_check
--   CHECK (employment_status IN (
--     'permanent', 'temporary', 'contractor', 'probation',
--     'intern', 'on-leave', 'terminated', 'resigned'
--   ));
