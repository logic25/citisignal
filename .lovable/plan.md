
# Combined Plan: Admin Users, Settings & Bulk Invite

## What Needs To Be Done

Three separate improvements discussed across multiple conversations, combined into one implementation:

---

## Part 1 — Admin Users Page: Show Email + Last Sign-In

**Current problem**: The User column shows either a display name or a raw UUID under it (the user_id). There is no email visible and no last sign-in time. This makes it impossible to identify who a user is.

**Fix**: Create a new backend function `admin-get-users` that uses admin-level access to read user emails and last sign-in timestamps from the authentication system, then merge that data into the users table display.

The Users table will gain:
- Email shown under the display name (e.g. "erussell25@gmail.com" instead of a UUID)
- "Last Sign-In" column showing when the user last logged in (or "Never" if they haven't)

**Tooltips added to table headers**:
- "User" → "The user's display name and email address"
- "Signed Up" → "Date the account was created"
- "Properties" → "Number of properties this user has added to their portfolio"
- "Role" → "Admin users can access the Admin Panel; regular users cannot"
- Eye icon → "View this user's full profile and activity history"

---

## Part 2 — Settings Page: Fix Broken Sections

**Current problem**: The Security tab has three buttons ("Change", "Enable", "View") that do nothing. The Billing tab shows fake "Free Plan" and "Payment Method" / "Billing History" rows that don't connect to anything real.

**Fixes**:

**Security tab**:
- "Change Password" button → wires to a real password reset email via the authentication system, shows a toast: "Password reset email sent — check your inbox"
- Remove "Two-Factor Authentication" row (not supported in current setup — showing it is misleading)
- Remove "Active Sessions" row (no session management API is available)

**Billing tab**:
- Replace the entire section with an honest informational card: "CitiSignal is currently in invite-only beta. Billing is not yet active — your access is complimentary while we build toward launch."
- Remove the fake "Payment Method" and "Billing History" rows

**Tooltips added to key settings fields**:
- "License / Expediter ID" → "Your professional license or expediter ID. Appears on the 'Prepared by' line of Due Diligence reports."
- "PO Terms" tab → "Your default Purchase Order terms — auto-applied to every PO you generate. You can override them per PO."
- "Telegram" tab → "Connect your Telegram account to receive real-time violation alerts via bot message."

---

## Part 3 — Bulk Invite: Send 3 Friends Their Codes in One Step

**Current problem**: To invite 3 friends you must repeat 6 manual steps (create code → copy → open Send Invite → select code → enter email → send) three separate times.

**Fix**: Add a "Bulk Invite" button next to "Send Invite" in the Admin Panel → Invite Codes tab.

**How it works**:
1. Click "Bulk Invite"
2. A dialog opens with a text area — enter multiple email addresses (one per line or comma-separated)
3. Optionally add a shared note for all the codes (e.g. "Friends beta Feb 2026")
4. Click "Send All Invites"
5. The system auto-generates a unique 8-character code per recipient, saves each to the database with `max_uses: 1`, then sends each person a branded invite email
6. Progress is shown in real-time: "Sending 2 of 3..."
7. A results summary shows which emails succeeded and which (if any) failed
8. The invite codes table refreshes automatically showing the new codes

---

## Files to Change

| File | What Changes |
|---|---|
| `supabase/functions/admin-get-users/index.ts` | New — backend function that reads emails + last sign-in using admin access, merged with profile data |
| `src/pages/dashboard/admin/AdminUsersPage.tsx` | Call the new function, display email + last sign-in, add tooltips to column headers |
| `src/pages/dashboard/SettingsPage.tsx` | Add tooltips to key fields; wire real password reset to Security tab; replace fake Billing content |
| `src/components/admin/InviteCodesTab.tsx` | Add "Bulk Invite" button and dialog with multi-email input, auto code generation, progress indicator |

No database schema changes are needed — all three improvements use existing tables and infrastructure.
