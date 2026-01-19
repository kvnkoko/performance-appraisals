-- Supabase Setup SQL Script
-- Run this in your Supabase SQL Editor

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- Create index for username lookups (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_users_username ON users(LOWER(username));

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can read all users" ON users;
DROP POLICY IF EXISTS "Users can manage users" ON users;

-- Create policy to allow all operations (for now - you can restrict later)
-- This allows the app to read/write users using the anon key
CREATE POLICY "Users can read all users" ON users
  FOR SELECT
  USING (true);

CREATE POLICY "Users can insert users" ON users
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update users" ON users
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete users" ON users
  FOR DELETE
  USING (true);
