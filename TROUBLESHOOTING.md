# Troubleshooting Guide

## Submit Job Number Button Not Working

If the "Submit Job Number" button in your Chrome extension isn't working, here are the steps to fix it:

### 1. Update Supabase Credentials

**The main issue is that you need to add your real Supabase credentials.**

1. **Open `config.js`** in your project
2. **Replace the placeholder values** with your actual Supabase credentials:

```javascript
const CONFIG = {
    SUPABASE: {
        URL: 'https://your-actual-project.supabase.co',  // Your real Supabase URL
        ANON_KEY: 'your-actual-anon-key'                // Your real anon key
    },
    // ... rest of config
};
```

### 2. Get Your Supabase Credentials

1. Go to [supabase.com](https://supabase.com) and sign in
2. Open your project dashboard
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** (looks like: `https://abc123.supabase.co`)
   - **Anon public key** (looks like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

### 3. Test the Button

After updating credentials:

1. **Reload your extension** in Chrome:
   - Go to `chrome://extensions/`
   - Find your extension
   - Click the refresh icon

2. **Navigate to a page with job numbers**

3. **Click the extension icon** and try "Submit Job Number"

4. **Check the console** for any error messages:
   - Right-click on the popup
   - Click "Inspect"
   - Look at the Console tab for errors

### 4. Common Error Messages

- **"Please update Supabase credentials"** → Update `config.js`
- **"No job number found on this page"** → The page doesn't have extractable job numbers
- **"Failed to get job number"** → Content script isn't working properly
- **"Supabase submission failed"** → Check your database table and RLS policies

### 5. Verify Database Setup

Make sure you have:

1. **Created the `job_submissions` table** in Supabase
2. **Set up Row Level Security (RLS)** policies
3. **Enabled the correct permissions**

### 6. Debug Steps

1. **Check if job numbers are being extracted:**
   - Open browser console
   - Look for "Response from content script" logs
   - Verify the job number is found

2. **Test Supabase connection:**
   - Try the test endpoint in your browser
   - Check if the API key has correct permissions

3. **Verify content script:**
   - Make sure `content.js` is injected on the page
   - Check if the `getJobNumber` action is working

### 7. Still Not Working?

If the button still doesn't work after following these steps:

1. **Check the browser console** for specific error messages
2. **Verify your Supabase project** is active and accessible
3. **Test with a simple page** that definitely has job numbers
4. **Check if the extension has the right permissions** in Chrome

### 8. Quick Test

To test if everything is working:

1. Update `config.js` with real credentials
2. Reload extension
3. Go to a page with job numbers
4. Open extension popup
5. Click "Submit Job Number"
6. Check console for success/error messages

The button should now work and submit job numbers to your Supabase database! 🎉
