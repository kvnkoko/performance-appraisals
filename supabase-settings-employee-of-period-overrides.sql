-- Add Employee of the Period overrides to settings (run in Supabase SQL Editor).
-- Stores per-period overrides: who was awarded Employee of the Period when you override the data-derived top scorer.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS employee_of_period_overrides JSONB DEFAULT NULL;
