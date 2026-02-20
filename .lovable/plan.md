
# Admin Panel: Invite Codes Tab, Tooltips Everywhere & Overview Enhancements

## Three things to fix

---

## 1. Where to Send Invites — Invite Codes Tab is Missing from Admin Panel

**The problem**: Looking at `AdminPage.tsx`, the tab list is:
- Overview / API Logs / Users / Roadmap / Feature Requests / Bug Reports

**The "Invite Codes" tab is not there.** The `InviteCodesTab` component exists and is fully built (with Bulk Invite), but it was never added to the Admin Panel tabs. Your friends need you to go to Admin → Invite Codes → click "Bulk Invite" — but that tab doesn't appear.

**Fix**: Add `<TabsTrigger value="invite-codes">Invite Codes</TabsTrigger>` and its `<TabsContent>` to `AdminPage.tsx`, importing `InviteCodesTab`.

---

## 2. Tooltips on Every Admin Table Column

Right now, only the Users page and API Logs page have tooltips. The Invite Codes table and Admin Overview cards have none.

### Invite Codes table — columns that need tooltips:

| Column | Tooltip text |
|---|---|
| Code | The unique invite code string. Click the copy icon to copy it to your clipboard. |
| Uses | How many times this code has been used vs. its limit (e.g. 1/3 means 1 person has signed up, 2 remaining). |
| Expires | The date after which this code can no longer be used to sign up. "Never" means it doesn't expire. |
| Notes | An optional label you added when creating this code, for your own reference. |
| Status | Active = the code can be used. Toggle it off to temporarily disable. Exhausted = the use limit has been reached. Expired = the expiry date has passed. |
| Created | When this invite code was generated. |

### Admin Overview — API Health cards:

Each endpoint pill (PLUTO, DOB_JOBS, ECB, etc.) needs a tooltip explaining what that dataset is:
- **PLUTO** → Property/zoning data from NYC's Primary Land Use Tax Output. Used to sync lot size, building class, and zoning info.
- **DOB_JOBS** → Department of Buildings permit applications — used to track active construction and alteration work on your properties.
- **ECB** → Environmental Control Board violations — fines and penalties issued for building code infractions.
- **OATH** → Office of Administrative Trials and Hearings — tracks hearing outcomes and adjudicated penalty amounts.
- **PAD** → Property Address Directory — used to resolve and normalize NYC addresses to their BIN/BBL identifiers.
- **DOB_VIOLATIONS** → Department of Buildings violations — structural and safety violations issued against a property.

The colored dot (green/yellow/red) also needs a tooltip: "Green = 0% error rate, Yellow = under 10% errors, Red = over 10% errors in the last 24 hours."

The `{stats.avgMs}ms` latency also needs a tooltip: "Average response time from NYC Open Data in milliseconds. Under 500ms is healthy."

---

## 3. Admin Overview Enhancements

Beyond average session time (which requires storing session duration in the database — a larger lift), here are **immediately buildable** improvements using data already available:

### New stat cards to add (row 2):
| Metric | Source | What it tells you |
|---|---|---|
| Total Open Violations | `violations` table, `status = open` | Already exists — move to better position |
| New Users (7 days) | `profiles.created_at` | How many people signed up this week |
| Invite Codes Active | `invite_codes` where `is_active = true` | How many codes are still usable |
| Properties with Violations | `violations` join `properties` | How many properties have at least one open issue |

### Improvements to the API Health section:
- Wrap each endpoint chip in a Tooltip explaining what that API does
- Add a "last updated" timestamp below the grid so you can see when the data was last refreshed
- Add a "View Full Logs →" link that navigates to Admin → API Logs tab

### Note on Average Session Time:
True average session time requires storing login/logout timestamps in a dedicated table whenever a user signs in or out — which is a new database table and trigger. This is doable but should be a separate task. For now, "Last Sign-In" on the Users tab shows activity, and "New Users (7 days)" shows growth.

---

## Files to Change

| File | What changes |
|---|---|
| `src/pages/dashboard/admin/AdminPage.tsx` | Add Invite Codes tab trigger + content, import InviteCodesTab |
| `src/components/admin/InviteCodesTab.tsx` | Wrap table headers in Tooltip, add TooltipProvider |
| `src/pages/dashboard/admin/AdminOverview.tsx` | Add new stat cards (new users 7d, invite codes active, properties with violations), add TooltipProvider + tooltips on each API endpoint chip and latency badge, add "View Full Logs" link |

No database changes or new edge functions needed.
