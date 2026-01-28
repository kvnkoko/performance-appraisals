-- Add HR weight and require-HR columns to settings table (run once if table already exists without them)
ALTER TABLE settings ADD COLUMN IF NOT EXISTS hr_score_weight INTEGER DEFAULT 30;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS require_hr_for_ranking BOOLEAN DEFAULT false;
