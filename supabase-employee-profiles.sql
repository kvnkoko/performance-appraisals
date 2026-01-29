-- Employee profiles table for Directory and Org Chart (profile pictures, bio, skills, etc.)
-- Run in Supabase SQL Editor. Uses TEXT id to match existing employees(id).

CREATE TABLE IF NOT EXISTS employee_profiles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  employee_id TEXT NOT NULL UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
  profile_picture TEXT,
  cover_photo TEXT,
  bio TEXT,
  headline VARCHAR(100),
  location VARCHAR(100),
  timezone VARCHAR(50),
  start_date DATE,
  birthday VARCHAR(5),
  pronouns VARCHAR(20),
  skills JSONB DEFAULT '[]',
  interests JSONB DEFAULT '[]',
  social_links JSONB DEFAULT '{}',
  contact_preferences JSONB DEFAULT '{}',
  phone_number VARCHAR(20),
  slack_handle VARCHAR(50),
  fun_facts JSONB DEFAULT '[]',
  achievements JSONB DEFAULT '[]',
  education JSONB DEFAULT '[]',
  previous_roles JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_profiles_employee_id ON employee_profiles(employee_id);

ALTER TABLE employee_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations" ON employee_profiles;
CREATE POLICY "Allow all operations" ON employee_profiles FOR ALL USING (true) WITH CHECK (true);
