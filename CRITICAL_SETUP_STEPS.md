# 🚨 CRITICAL: Run This SQL Script NOW!

## The Problem
Right now, only **users** are stored in Supabase. Templates, employees, appraisals, and all other data are still in IndexedDB (browser-local), which is why they don't sync across devices.

## The Solution
Run the **complete SQL script** to create ALL the tables in Supabase.

## Steps (2 minutes):

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard
2. **Click your project**
3. **Click "SQL Editor"** in the left sidebar
4. **Click "New Query"**
5. **Open the file**: `supabase-setup-complete.sql` in this project
6. **Copy ALL the SQL code** from that file
7. **Paste it** into the SQL Editor
8. **Click "Run"** (or press Cmd/Ctrl + Enter)
9. **Wait for "Success"** message

## After Running the SQL:

✅ **Templates** will sync across all devices
✅ **Employees** will sync across all devices  
✅ **Appraisals** will sync across all devices
✅ **Links** will sync across all devices
✅ **Settings** will sync across all devices
✅ **Review Periods** will sync across all devices

## Test It:

1. Create a template on your PC
2. Open the Vercel link on your other computer
3. **The template should be there!** 🎉

---

**This is the missing piece!** Once you run this SQL, everything will work as one unified system.
