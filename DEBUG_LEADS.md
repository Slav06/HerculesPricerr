# Debugging Missing Leads / Submissions

Use this when some leads show up in the dashboard but others don’t, and the webhook is working (some submissions are created).

---

## 1. Why a lead might be “missing”

### A. **Webhook never created a row**

- **Skipped – no identifying info**  
  The webhook only creates/updates a job submission if the contact has at least one of: **name** (not empty/“Unknown”), **email**, or **phone**.  
  If the GHL payload has no name/email/phone, the webhook logs “Skipping contact - no name, email, or phone” and does **not** create a submission.

- **Skipped – delete event**  
  For `contact.deleted` (or similar), the webhook does **not** create or update job submissions.

- **Event type not handled**  
  Only contact-like, opportunity-like, and appointment-like events create/update job submissions. Other event types may only be logged or trigger a “full sync” that doesn’t create a single submission.

- **Create/update failed**  
  Supabase can return an error (e.g. validation, RLS, duplicate key). The webhook logs “Failed to create job submission” (or update) and the response body. Check **Vercel → Project → Logs** for that error.

### B. **Lead was treated as an update, not a new lead**

- The webhook **updates by email first, then by phone**:
  - If a job submission already exists with the **same email**, the webhook **updates** that row (same `id`), it does **not** create a second row.
  - If no email match but a row exists with the **same phone**, it updates that row.
- So if two “leads” in GHL share the same email (or phone), you will only see **one** submission in the dashboard (the latest update). The “missing” one is the same row, updated.

### C. **Dashboard filters (role + search)**

- **Fronter**  
  Only submissions where **Submitted By** = current user’s name are shown.  
  Submissions created by the **webhook** have no `user_name`/`chrome_profile_name`, so they get **Submitted By = “Unknown”**.  
  So **webhook-created leads will not show for a fronter** unless you change the logic or set `user_name` for those rows.

- **Closer**  
  Only submissions where **Transferred To** or **Assigned To** = current closer’s name are shown.  
  If a lead was never assigned/transferred to that closer, it won’t appear for them.

- **Admin**  
  Sees all submissions that were loaded (no role filter). If it’s “missing” for admin too, it’s either not in the DB (A or B above) or beyond the loaded set (see D).

- **Search**  
  The search box filters by job #, customer, phone, email, notes, etc. A typo or different spelling can hide a lead.

### D. **Limit / pagination**

- The dashboard loads at most **10,000** submissions (`limit=10000`).  
  If you have more than 10k rows in `job_submissions`, the oldest (by `submitted_at`) are not loaded and will never appear until you increase the limit or add server-side filtering/pagination.

---

## 2. How to debug a specific “missing” lead

### Step 1: Confirm it’s in the database

- Use the dashboard **Debug missing leads** panel (Admin only):
  - **Look up by Job # or email**: enter the job number or email of the missing lead and click **Look up**.
  - If a row is found, the panel shows that submission’s key fields (e.g. `job_number`, `customer_name`, `submitted_by`, `assigned_to`, `transferred_to`, `source`).
  - If **Not found**, the lead was never created (or not with that job #/email) → focus on **Section 1A and 1B**.

### Step 2: Interpret the lookup result

- **submitted_by = “Unknown”**  
  Likely created by the webhook. It will **not** show for fronters (they only see their own name). It will show for **Admin** unless something else filters it out.

- **assigned_to / transferred_to**  
  If both are empty, closers won’t see it. Only admin (and fronters if submitted_by matches) will see it.

- **source**  
  “GoHighLevel Webhook” = created/updated by the GHL webhook. Other values = other sources (e.g. extension, manual).

### Step 3: Check webhook and Vercel logs

- In **Vercel** → your project → **Logs**, filter by the time when the lead should have been created.
- Look for:
  - “GoHighLevel Webhook Received” (payload logged).
  - “Processing as contact event” (or other event type).
  - “Skipping contact - no name, email, or phone” → lead was skipped.
  - “Created job submission from webhook” vs “Updated job submission” → create vs update.
  - “Failed to create job submission” / “Failed to update” and the error text → Supabase/validation issue.

### Step 4: Check GoHighLevel

- In GHL, open the contact record for the missing lead.
- Confirm it has at least one of: name (not “Unknown”), email, phone.
- Confirm the webhook is subscribed to the right events (e.g. `contact.created`, `contact.updated`) and that the webhook URL is correct.
- If GHL sends a different payload shape for some events, the webhook might not find `contact` or `data` and might skip or handle the event differently.

---

## 3. Quick fixes

| Symptom | What to check / do |
|--------|---------------------|
| Webhook-created leads not visible to **fronters** | They have `submitted_by = 'Unknown'`. Either show “Unknown” submissions to fronters, or set a default `user_name` when the webhook creates a row (e.g. “Webhook” or a specific fronter). |
| Lead not visible to **closers** | Assign or transfer the lead to that closer so `assigned_to` or `transferred_to` is set. |
| Two leads, only one row | They share the same email (or phone). Webhook updates one row. If you need two separate submissions, they must have different email/phone or you need to change the webhook “match by email/phone” logic. |
| Lead not in DB at all | Check logs for “Skipping contact”, “No contact data”, or “Create failed”. Fix payload (GHL) or webhook parsing (contact extraction) or Supabase error (e.g. RLS, schema). |
| More than 10k submissions | Increase `limit` in the dashboard request or implement server-side date/range or cursor-based pagination so you can load older submissions. |

---

## 4. Dashboard debug panel (Admin)

- **Location**: Job Submissions tab, above the table (admin only).
- **Counts**: Total loaded from API | After role filter | After search.  
  Use this to see whether the lead is dropped by role filter or search.
- **Look up**: By job number or email, shows the raw row (or “Not found”) so you can confirm existence and see `submitted_by`, `assigned_to`, `transferred_to`, `source`.

This gives you a clear path: **in DB or not** → **why filtered** (role/search) → **why not created** (webhook skip/update/fail) or **limit**.
