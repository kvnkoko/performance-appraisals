# 🚀 Supabase Setup - Super Simple Guide

## ✅ What's Already Done
- ✅ Supabase package installed
- ✅ Code integration complete
- ✅ Your Supabase URL configured: `https://fvzpkzaualqgeyrulckf.supabase.co`

## 📋 What You Need to Do (3 Simple Steps)

### Step 1: Get Your Anon Key (1 minute)

1. Go to: https://supabase.com/dashboard
2. Click on your project
3. Click **Settings** (⚙️ icon in left sidebar)
4. Click **API** in the settings menu
5. Find the section called **"Project API keys"**
6. Copy the **"anon public"** key (it's a long string like `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)
7. **Save it somewhere safe** - you'll need it in Step 2!

### Step 2: Run the SQL Script (1 minute)

1. Still in Supabase dashboard, click **SQL Editor** in the left sidebar
2. Click **New Query** button
3. Open the file `supabase-setup.sql` in this project folder
4. **Copy ALL the text** from that file
5. **Paste it** into the SQL Editor
6. Click **Run** button (or press Cmd+Enter / Ctrl+Enter)
7. You should see: ✅ "Success. No rows returned"

### Step 3: Add Your Anon Key (1 minute)

#### Option A: Using the Setup Script (Easiest)

Run this in your terminal:
```bash
chmod +x setup-env.sh
./setup-env.sh
```

Then open `.env.local` and replace `YOUR_ANON_KEY_HERE` with your actual anon key from Step 1.

#### Option B: Manual Setup

1. Create a file called `.env.local` in the project root (same folder as `package.json`)
2. Add these two lines (replace `YOUR_ANON_KEY_HERE` with your actual key):

```
VITE_SUPABASE_URL=https://fvzpkzaualqgeyrulckf.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
```

3. Save the file

### Step 4: Add to Vercel (For Production)

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Click on your project
3. Go to **Settings** → **Environment Variables**
4. Click **Add New**
5. Add these two variables:

**Variable 1:**
- Name: `VITE_SUPABASE_URL`
- Value: `https://fvzpkzaualqgeyrulckf.supabase.co`
- Check: Production, Preview, Development

**Variable 2:**
- Name: `VITE_SUPABASE_ANON_KEY`
- Value: (paste your anon key from Step 1)
- Check: Production, Preview, Development

6. Click **Save** for each

## 🎉 Test It!

1. Restart your dev server:
   ```bash
   npm run dev
   ```

2. Try logging in:
   - Use PIN: `1234` (should work)
   - Go to Users page
   - Create a test user
   - Log out and log back in with that user
   - **Try from a different browser** - it should work! 🎊

## ❓ Troubleshooting

**"Supabase not configured" message?**
- Make sure `.env.local` exists and has both variables
- Restart your dev server after creating `.env.local`
- Check that your anon key is correct (no extra spaces)

**Can't see users?**
- Check Supabase dashboard → Table Editor → users table
- Make sure you ran the SQL script (Step 2)

**Still using IndexedDB?**
- Check browser console for errors
- Verify environment variables are set correctly

## 🎯 That's It!

Once you complete these steps, your app will:
- ✅ Store users in Supabase (server-side)
- ✅ Allow login from ANY browser/device
- ✅ Work like a real CMS portal!

Need help? Check the console logs - they'll tell you if Supabase is configured correctly.
