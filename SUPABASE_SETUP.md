# Supabase Setup Guide

This guide will help you set up Supabase for server-side user authentication, allowing users to log in from any browser or device.

## Why Supabase?

- **Free tier** with generous limits
- **PostgreSQL database** - industry standard
- **Real-time capabilities** (for future features)
- **Works seamlessly with Vercel**
- **Secure authentication** out of the box

## Step 1: Create a Supabase Account

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project" and sign up (free)
3. Create a new project:
   - Choose a name (e.g., "appraisals-portal")
   - Set a database password (save this!)
   - Choose a region close to you
   - Wait 2-3 minutes for setup

## Step 2: Get Your API Keys

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

## Step 3: Create the Users Table

1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Paste this SQL and run it:

```sql
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

-- Create index for username lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(LOWER(username));

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to read all users
CREATE POLICY "Users can read all users" ON users
  FOR SELECT
  USING (true);

-- Create policy to allow authenticated users to insert/update/delete
-- For now, we'll allow all operations (you can restrict this later)
CREATE POLICY "Users can manage users" ON users
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

## Step 4: Configure Environment Variables

### For Local Development

1. Create a `.env.local` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

2. Replace the values with your actual Supabase URL and anon key from Step 2.

### For Vercel Deployment

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add these variables:
   - `VITE_SUPABASE_URL` = Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = Your Supabase anon key
4. Make sure to add them for **Production**, **Preview**, and **Development**
5. Click **Save**

## Step 5: Install Dependencies

Run this command in your project:

```bash
npm install @supabase/supabase-js
```

## Step 6: Test the Setup

1. Start your dev server: `npm run dev`
2. The app will automatically use Supabase if the environment variables are set
3. Try creating a user in the Users page
4. Check your Supabase dashboard → **Table Editor** → **users** to see the data

## How It Works

- **With Supabase configured**: Users are stored in Supabase and can log in from any browser/device
- **Without Supabase**: Falls back to IndexedDB (browser-local storage)

## Migrating Existing Users

If you have users in IndexedDB that you want to migrate to Supabase:

1. Export data from Settings page (in the browser with existing users)
2. The export includes users
3. You can manually import them via Supabase dashboard or create a migration script

## Troubleshooting

### "Supabase not configured" message
- Check that `.env.local` exists and has the correct variables
- Restart your dev server after adding environment variables
- For Vercel, ensure environment variables are set in the dashboard

### Users not appearing
- Check Supabase dashboard → Table Editor → users
- Verify RLS policies are set correctly
- Check browser console for errors

### Can't log in
- Verify the users table exists in Supabase
- Check that username/password hash are being saved correctly
- Ensure RLS policies allow SELECT operations

## Security Notes

- The `anon` key is safe to use in client-side code (it's public)
- Row Level Security (RLS) policies control access
- Passwords are hashed using SHA-256 (consider upgrading to bcrypt for production)
- For production, consider adding more restrictive RLS policies

## Next Steps

Once Supabase is set up:
- Users can log in from any browser/device
- User data is centralized and persistent
- You can add more features like password reset, email verification, etc.
