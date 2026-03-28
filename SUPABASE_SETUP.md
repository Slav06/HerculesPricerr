# Supabase Setup Guide

This guide will help you set up Supabase to store job submissions from your Page Price Analyzer Extension.

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/sign in
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name**: `page-price-analyzer` (or your preferred name)
   - **Database Password**: Create a strong password
   - **Region**: Choose closest to your users
5. Click "Create new project"
6. Wait for the project to be created (usually 2-3 minutes)

## 2. Get Your Project Credentials

1. In your project dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL**: `https://your-project-id.supabase.co`
   - **Anon public key**: `your-anon-key`

## 3. Create the Database Table

1. Go to **Table Editor** in your Supabase dashboard
2. Click **New Table**
3. Use these settings:

```sql
-- Table name: job_submissions
-- Columns:
- id (int8, primary key, auto-increment)
- job_number (text, not null)
- page_url (text)
- submitted_at (timestamptz, default: now())
- source (text, default: 'Page Price Analyzer Extension')
- created_at (timestamptz, default: now())
```

4. Click **Save**

## 4. Set Up Row Level Security (RLS)

1. Go to **Authentication** → **Policies**
2. Find your `job_submissions` table
3. Click **New Policy**
4. Choose **Create a policy from scratch**
5. Use these settings:

```sql
-- Policy name: Enable insert for authenticated users
-- Target roles: authenticated
-- Using expression: true
-- With check expression: true
```

6. Click **Review** then **Save policy**

## 5. Update Your Extension Configuration

1. **Update popup.js**:
   - Replace `https://your-project.supabase.co` with your actual project URL
   - Replace `your-anon-key` with your actual anon key

2. **Update dashboard.html**:
   - Replace the same values in the JavaScript section

## 6. Test the Integration

1. **Reload your extension** in Chrome
2. **Navigate to a page** with job numbers
3. **Click the extension icon** and use "Submit Job Number"
4. **Check your Supabase dashboard** to see the new record

## 7. View Your Dashboard

1. **Open dashboard.html** in your browser
2. **Update the Supabase credentials** in the JavaScript
3. **Refresh the page** to see your data

## Database Schema Details

```sql
CREATE TABLE job_submissions (
    id BIGSERIAL PRIMARY KEY,
    job_number TEXT NOT NULL,
    page_url TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    source TEXT DEFAULT 'Page Price Analyzer Extension',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE job_submissions ENABLE ROW LEVEL SECURITY;

-- Create policy for inserts
CREATE POLICY "Enable insert for authenticated users" ON job_submissions
    FOR INSERT WITH CHECK (true);

-- Create policy for selects
CREATE POLICY "Enable select for authenticated users" ON job_submissions
    FOR SELECT USING (true);
```

## Troubleshooting

### Common Issues:

1. **CORS Error**: Make sure your Supabase project allows requests from your domain
2. **Authentication Error**: Verify your API keys are correct
3. **Table Not Found**: Ensure the table name matches exactly
4. **Permission Denied**: Check your RLS policies

### Testing API Endpoints:

You can test your Supabase connection using curl:

```bash
# Test connection
curl -X GET "https://your-project.supabase.co/rest/v1/job_submissions" \
  -H "apikey: your-anon-key" \
  -H "Authorization: Bearer your-anon-key"

# Test insert
curl -X POST "https://your-project.supabase.co/rest/v1/job_submissions" \
  -H "apikey: your-anon-key" \
  -H "Authorization: Bearer your-anon-key" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{"job_number":"TEST123","page_url":"https://example.com","source":"Test"}'
```

## Security Notes

- The anon key is public and safe to use in browser extensions
- RLS policies control access to your data
- Consider implementing rate limiting for production use
- Monitor your API usage in the Supabase dashboard

## Next Steps

Once set up, you can:
1. **Customize the dashboard** styling and functionality
2. **Add more fields** to track additional job information
3. **Implement user authentication** for admin access
4. **Set up automated backups** and monitoring
5. **Create additional views** for different data analysis needs
