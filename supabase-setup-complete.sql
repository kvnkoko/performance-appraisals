-- Complete Supabase Setup SQL Script
-- Run this in your Supabase SQL Editor to store ALL data server-side

-- ============================================
-- 1. USERS TABLE (already exists, but including for completeness)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff')),
  active BOOLEAN DEFAULT true,
  employee_id TEXT,
  must_change_password BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(LOWER(username));

-- Migrations: ensure columns exist for existing installs (no-op if already present)
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;

-- ============================================
-- 2. TEMPLATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subtitle TEXT,
  type TEXT NOT NULL,
  categories JSONB NOT NULL,
  questions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  version INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_templates_type ON templates(type);

-- ============================================
-- 3. EMPLOYEES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL,
  hierarchy TEXT NOT NULL CHECK (hierarchy IN ('executive', 'leader', 'member')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_hierarchy ON employees(hierarchy);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS team_id TEXT;

-- ============================================
-- 3b. TEAMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_created ON teams(created_at);

-- ============================================
-- 4. REVIEW PERIODS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS review_periods (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Q1', 'Q2', 'Q3', 'Q4', 'H1', 'H2', 'Annual', 'Custom')),
  year INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('planning', 'active', 'completed', 'archived')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_periods_status ON review_periods(status);
CREATE INDEX IF NOT EXISTS idx_review_periods_year ON review_periods(year);

-- ============================================
-- 5. APPRAISALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS appraisals (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  appraiser_id TEXT NOT NULL,
  review_period_id TEXT NOT NULL,
  review_period_name TEXT NOT NULL,
  responses JSONB NOT NULL,
  score NUMERIC NOT NULL,
  max_score NUMERIC NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appraisals_employee ON appraisals(employee_id);
CREATE INDEX IF NOT EXISTS idx_appraisals_appraiser ON appraisals(appraiser_id);
CREATE INDEX IF NOT EXISTS idx_appraisals_review_period ON appraisals(review_period_id);

-- ============================================
-- 6. APPRAISAL LINKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS appraisal_links (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  appraiser_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  review_period_id TEXT,
  review_period_name TEXT,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appraisal_links_token ON appraisal_links(token);
CREATE INDEX IF NOT EXISTS idx_appraisal_links_employee ON appraisal_links(employee_id);

-- ============================================
-- 7. SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  logo TEXT,
  admin_pin TEXT NOT NULL,
  accent_color TEXT NOT NULL,
  theme TEXT NOT NULL CHECK (theme IN ('light', 'dark', 'system')),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. PERFORMANCE SUMMARIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS performance_summaries (
  employee_id TEXT PRIMARY KEY,
  summary_text TEXT NOT NULL,
  insights JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE appraisals ENABLE ROW LEVEL SECURITY;
ALTER TABLE appraisal_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_summaries ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CREATE POLICIES (Allow all operations for now)
-- ============================================

-- Drop existing policies if they exist
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('users', 'templates', 'employees', 'teams', 'review_periods', 'appraisals', 'appraisal_links', 'settings', 'performance_summaries')) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Allow all operations" ON %I', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "Users can read all" ON %I', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "Users can manage" ON %I', r.tablename);
  END LOOP;
END $$;

-- Create policies for all tables
CREATE POLICY "Allow all operations" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON teams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON review_periods FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON appraisals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON appraisal_links FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON performance_summaries FOR ALL USING (true) WITH CHECK (true);
