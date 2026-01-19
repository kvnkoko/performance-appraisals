# Quick Supabase Setup Guide

## Your Supabase URL
✅ **Project URL**: `https://fvzpkzaualqgeyrulckf.supabase.co`

## Step 1: Get Your Anon Key (2 minutes)

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Click on your project
3. Go to **Settings** (gear icon in sidebar) → **API**
4. Find **"anon public"** key (it's a long string starting with `eyJ...`)
5. Copy that entire key

## Step 2: Run the SQL Script (1 minute)

1. In Supabase dashboard, click **SQL Editor** in the sidebar
2. Click **New Query**
3. Open the file `supabase-setup.sql` in this project
4. Copy ALL the SQL code from that file
5. Paste it into the SQL Editor
6. Click **Run** (or press Cmd/Ctrl + Enter)
7. You should see "Success. No rows returned"

## Step 3: Add Environment Variables

### For Local Development:

I'll create a `.env.local` file for you. You just need to add your anon key.

### For Vercel:

1. Go to your Vercel dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add these two variables:

**Variable 1:**
- Name: `VITE_SUPABASE_URL`
- Value: `https://fvzpkzaualqgeyrulckf.supabase.co`
- Environments: Production, Preview, Development (check all)

**Variable 2:**
- Name: `VITE_SUPABASE_ANON_KEY`
- Value: (paste your anon key from Step 1)
- Environments: Production, Preview, Development (check all)

5. Click **Save** for each variable

## Step 4: Test It!

1. Restart your dev server: `npm run dev`
2. Try logging in with PIN: `1234`
3. Go to Users page and create a test user
4. Log out and log back in with that user
5. Try logging in from a different browser - it should work! 🎉

## That's It!

Once you complete these steps, your app will use Supabase for user storage, and users can log in from any browser or device!
