# Why "Failed to store analytics data" Happened

The webhook failed when writing to the **`ghl_analytics`** table because of **Row Level Security (RLS)**.

## Cause

In `CREATE_GHL_ANALYTICS_TABLE.sql`, the table has RLS enabled and only **authenticated** users can insert:

```sql
CREATE POLICY "Admin users can insert GHL analytics"
ON public.ghl_analytics
FOR INSERT
TO authenticated   -- ← only logged-in users
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.dashboard_users
        WHERE dashboard_users.id = auth.uid() 
        AND dashboard_users.role = 'admin' ...
    )
);
```

The **GHL webhook** runs on Vercel and uses the **Supabase anon key** (no logged-in user). So:

- Role is **anon**, not **authenticated**
- No policy allows **anon** to INSERT into `ghl_analytics`
- Supabase rejects the insert (403 / empty error body)
- The webhook then returned 500 with "Failed to store analytics data: {}"

## Fixes (pick one)

### Option A – Allow webhook to insert (new RLS policy)

Run this in Supabase SQL so the anon key can insert only rows that look like webhook/sync records:

```sql
-- Allow server/webhook to insert analytics (e.g. synced_by = 'webhook' or 'system')
CREATE POLICY "Allow webhook to insert GHL analytics"
ON public.ghl_analytics
FOR INSERT
TO anon
WITH CHECK (synced_by IN ('webhook', 'system'));
```

After this, the webhook (using the anon key) can insert into `ghl_analytics` again.

### Option B – Use the Service Role key in the webhook (bypasses RLS)

- In Supabase: **Settings → API** copy the **service_role** key (secret, server-only).
- In your Vercel project: add env var e.g. `SUPABASE_SERVICE_ROLE_KEY`.
- In `api/ghl-webhook.js`: use that key **only** for the `ghl_analytics` insert (keep anon for `job_submissions` if that’s what you use for other access).

Then the insert is allowed because the service role bypasses RLS. Never expose the service role key to the browser or public.

### Option C – Do nothing (current behavior)

Analytics storage is already **non-fatal**: if the insert fails, the webhook still returns 200 and **job submissions are still created/updated**. Only the analytics/audit row in `ghl_analytics` is skipped. You can fix RLS later when you want that data again.
