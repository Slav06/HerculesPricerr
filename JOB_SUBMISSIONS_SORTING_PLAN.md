# Job Submissions – Sorting & Follow-up Sequence Plan

## Goal
- **Top of list:** Leads that need to be called soonest (by status + callback time).
- **Bottom of list:** Leads that are “not good” or already closed.
- Each **job status** has its own place in a **follow-up sequence** so the table is ordered by “next in line to be called.”

---

## 1. Data You Already Have

| Source | What it drives |
|--------|-----------------|
| **`status`** (job_submissions) | pending, inv_done, transferred, dropped, cb_scheduled, disqualified, hung_up, completed, cancelled, booked, payment_captured |
| **`lead_outcome`** | not_interested, another_followup, no_answer, voicemail, booked |
| **`callback_date` / `callback_time` / `callback_datetime`** | When to call back |
| **`closer_notes`** | Has notes but maybe no callback yet |
| **`priority_level`** | Numeric priority (higher = more urgent) |

---

## 2. Status Tiers (Follow-up sequence)

Group statuses into tiers. **Lower tier number = higher in the list** (call first).

| Tier | Name | Statuses | Meaning |
|------|------|----------|--------|
| **1** | Call now / urgent | inv_done (needs pricing), cb_scheduled (when callback is due/overdue) | Needs immediate action or callback is due |
| **2** | Ready for follow-up | transferred, pending | Active leads, call when callback time is next |
| **3** | Waiting / soft follow-up | (same as 2 but callback in future, or has notes only) | Schedule call when due |
| **4** | Cold / no outcome yet | (no callback, no outcome) | Contact when capacity allows |
| **5** | Not good / closed | dropped, disqualified, hung_up, cancelled, completed | Do not call; show at bottom |
| **6** | Won / done | booked, payment_captured | Success; can go near bottom or in separate section |

**Lead outcome** overrides when it means “closed”:
- **another_followup** → stay in “follow-up” pool; use **callback_datetime** or **next_followup_date** for order.
- **not_interested, no_answer, voicemail** (if you treat some as “not good”) → can go to a lower tier or bottom section.

You can adjust which statuses sit in which tier; the code will use a **config object** (see below).

---

## 3. Sort Order (Single Pass)

Apply one sort that combines status tier and callback time. Conceptually:

1. **Tier first**  
   Lower tier number first (e.g. Tier 1, then 2, then 3, 4, 5, 6).

2. **Within “call next” (e.g. Tiers 1–4):**  
   - Overdue callbacks first (callback_datetime &lt; now).  
   - Then by **soonest callback** (callback_datetime ascending).  
   - Then “has notes, no callback” (so you don’t lose them).  
   - Then by **priority_level** (descending).  
   - Then by **submitted_at** (oldest first) so older leads don’t get stuck.

3. **Within “not good” / “closed” (Tiers 5–6):**  
   - Optional: by outcome_date or updated_at (newest last) so recently closed stay visible.

4. **Booked / payment_captured:**  
   - Either bottom of list or a dedicated “Booked” section at bottom.

Result: **Leads to call now at the very top; “not good” and booked at the bottom.**

---

## 4. Per-Status Follow-up Sequence (Config)

Define a small config that maps status → tier and optionally “treat as call-ready”:

```javascript
const STATUS_SORT_TIER = {
  // Tier 1 – urgent / call now
  inv_done: 1,
  cb_scheduled: 1,   // when callback is due/overdue, already pushed up by callback time
  // Tier 2 – active follow-up
  transferred: 2,
  pending: 2,
  // Tier 3 – waiting (or use same as 2 and let callback time decide)
  // Tier 4 – cold
  // (pending/transferred with no callback could stay in 2 with lowest priority)
  // Tier 5 – not good
  dropped: 5,
  disqualified: 5,
  hung_up: 5,
  cancelled: 5,
  completed: 5,
  // Tier 6 – won
  booked: 6,
  Booked: 6,
  payment_captured: 6
};
// Default for unknown status: e.g. 4 (cold) or 2 (active)
```

You can add more tiers (e.g. 3 = “waiting”, 4 = “cold”) and move statuses between tiers without changing the rest of the logic.

---

## 5. Outcome Handling

- **lead_outcome = 'another_followup'**  
  - Keep in “follow-up” pool.  
  - Use **callback_datetime** or **next_followup_date** for “next in line.”

- **lead_outcome in ('not_interested', 'no_answer', 'voicemail')**  
  - Either:  
    - Move to a lower tier (e.g. 5 “not good”), or  
    - Keep in follow-up but sort after “no outcome” leads.  
  - Your choice: treat “no_answer” / “voicemail” as still callable (higher) and “not_interested” as bottom.

Suggested rule for “not good” at bottom:
- **not_interested** → same tier as dropped/disqualified (bottom).
- **no_answer / voicemail** → either same as “another_followup” (by callback) or one tier below “active.”

---

## 6. Optional: Status Filter

- Add a **filter** above the table: **All | Call now | Active | Not good | Booked** (or by status).  
- “Call now” = tier 1 + overdue callbacks.  
- “Active” = tier 2–4.  
- “Not good” = tier 5.  
- “Booked” = tier 6.  
- Filter is applied **before** the sort; sort rules stay the same within visible rows.

---

## 7. Implementation Steps

| Step | Task |
|------|------|
| 1 | Add **STATUS_SORT_TIER** (and optional **OUTCOME_TIER** or outcome → “closed”) in `dashboard.html`. |
| 2 | Replace or extend the current **filteredSubmissions.sort()** (fronter/closer/admin) with: (a) tier from status (and outcome), (b) overdue first, (c) soonest callback, (d) notes-only, (e) priority, (f) submitted_at. |
| 3 | Keep **pinned follow-up leads** logic: still compute “due/overdue” and pin them at top for fronters; apply the same tier + callback order within that block. |
| 4 | (Optional) Add a **Sort by** dropdown or **Status filter** (All / Call now / Active / Not good / Booked) and filter the list before sorting. |
| 5 | (Optional) Add a small “Status” or “Tier” column so users see why a row is at the top or bottom. |

---

## 8. One-Page Sort Logic (Pseudocode)

```
for each submission:
  tier = STATUS_SORT_TIER[status] or 4
  if lead_outcome === 'not_interested': tier = 5
  (optional) if lead_outcome in ['no_answer','voicemail']: tier = max(tier, 4)
  submission._sortTier = tier

sort by:
  1) _sortTier ascending
  2) if tier in [1,2,3,4]: 
       - overdue (callback_datetime < now) first
       - then callback_datetime ascending (null last or as Infinity)
       - then has_notes no_callback before no_notes
       - then priority_level descending
       - then submitted_at ascending
  3) if tier in [5,6]: 
       - optional: outcome_date or updated_at descending (newest first)
```

---

## 9. Summary

- **Status** and optionally **lead_outcome** define a **tier** (follow-up sequence).
- **One sort** uses: tier → callback urgency → callback time → notes → priority → age.
- **Top** = call now / next in line; **bottom** = not good + booked.
- Implement with a **config object** (STATUS_SORT_TIER, outcome rules) so you can change tiers or add filters later without rewriting the whole sort.

If you want, next step is to implement this in `dashboard.html`: add the config and the new sort function, and wire it for fronter (and optionally closer/admin) views.
