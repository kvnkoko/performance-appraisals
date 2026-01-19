# Data Migration Guide

## How to Transfer Your Data from Localhost to Vercel

Since IndexedDB is stored locally in your browser, your data from localhost won't automatically appear in the Vercel deployment. Here's how to transfer it:

### Step 1: Export Data from Localhost

1. Open your **localhost** application (e.g., `http://localhost:5173`)
2. Log in with your PIN or username/password
3. Navigate to **Settings** (gear icon in sidebar)
4. Scroll down to the **"Data Management"** section
5. Click **"Export Data"** button
6. A JSON file will download (e.g., `appraisal-backup-2025-01-19.json`)
7. **Save this file** - you'll need it in the next step

### Step 2: Import Data into Vercel

1. Open your **Vercel deployment** (your production URL)
2. Log in with your PIN or username/password
3. Navigate to **Settings** (gear icon in sidebar)
4. Scroll down to the **"Data Management"** section
5. Click **"Choose File"** under **"Import Data"**
6. Select the JSON file you downloaded in Step 1
7. Confirm the import when prompted
8. Your data will be imported! ✅

### What Gets Transferred

The export includes:
- ✅ **Templates** - All your appraisal templates
- ✅ **Employees** - All employee records
- ✅ **Appraisals** - All completed appraisals
- ✅ **Links** - All appraisal links
- ✅ **Review Periods** - All review periods
- ✅ **Settings** - Company settings and preferences
- ✅ **Users** - All user accounts (if you've created any)

### Important Notes

- ⚠️ **Importing will replace all existing data** in the Vercel deployment
- 💡 You can export multiple times to create backups
- 🔄 You can import the same file multiple times (it will overwrite)
- 📦 The export file is a complete backup of your database

### Troubleshooting

**If import fails:**
- Make sure the file is a valid JSON file
- Check that you exported from the same version of the app
- Try exporting again from localhost

**If data doesn't appear:**
- Refresh the page after importing
- Check the browser console for errors
- Make sure you're logged in as an admin user
