
# Team Workspace: Shared Access for Fuertes Management

## The Problem
Right now CitiSignal is strictly one account = one data silo. Each of TJ, Erika, and Mike would sign up and see a completely empty dashboard. They'd each have to manually add the same Fuertes Management buildings separately — and none of them would see each other's data.

The `property_members` table already exists in the database, but it only gives someone read-only access to a single property. It does not allow shared property creation, shared violations, or a unified portfolio view across team members.

---

## What Needs to Be Built

The cleanest approach for the testers' scenario: **one person (say, TJ as the account owner) adds all the Fuertes Management buildings**, then invites Erika and Mike as members at the property level. Erika and Mike log in, go to their dashboard, and see those shared properties listed — along with all violations, work orders, compliance, etc.

This does NOT require a complex multi-tenant org system. The `property_members` table is already the right foundation. What's missing is:

1. The RLS policies on all related tables need to allow access when a user is a member (not just the owner)
2. The Properties page needs to fetch properties where the user is either owner OR an accepted member
3. The onboarding invites need to be matched to a real account when the invited user signs up

---

## Technical Implementation Plan

### Step 1 — Database: Extend RLS Policies

Currently every table (violations, work orders, applications, etc.) checks `properties.user_id = auth.uid()`. We need to add a secondary check: OR the user is an accepted member of that property.

Create a helper database function to avoid repeating the join everywhere:

```sql
CREATE OR REPLACE FUNCTION public.is_property_member(_property_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM property_members
    WHERE property_id = _property_id
      AND user_id = auth.uid()
      AND status = 'accepted'
  )
$$;
```

Then update the `SELECT` RLS policy on the `properties` table to:
```sql
auth.uid() = user_id OR is_property_member(id)
```

And update SELECT policies on:
- `violations`
- `applications`
- `work_orders`
- `compliance_requirements`
- `compliance_scores`
- `property_documents`
- `property_activity_log`
- `notifications`
- `change_log`

Members would get **read access** (SELECT) by default. Write access (INSERT/UPDATE/DELETE) stays owner-only for safety, or can be extended per role if needed.

### Step 2 — Member Invite → Account Link

Right now when TJ invites "mike@fuertes.com" to a property, a row is created in `property_members` with `status: 'pending'` and `user_id` set to TJ's ID (wrong — it should be empty until Mike accepts).

Fix: When inserting a pending invite, set `user_id` to the owner's ID only as a temporary placeholder, OR leave it null until Mike accepts.

When Mike signs up and logs in for the first time, check if any pending invites exist for his email and auto-link them:
- Query `property_members` for rows where `email = user.email AND status = 'pending'`
- Update those rows: set `user_id = user.id, status = 'accepted', accepted_at = now()`

This can happen in the auth flow (after sign-in) or in the onboarding wizard.

### Step 3 — Properties Page: Show Shared Properties

Currently `PropertiesPage.tsx` only fetches `properties` where the logged-in user is the owner (`user_id = auth.uid()`). After the RLS change, it will automatically return shared properties too — but we need to visually distinguish them.

Add a "Shared" badge on property cards/rows where `user_id !== currentUser.id` so team members know which properties they own vs. were added to.

### Step 4 — Invite Flow Polish (Optional but Recommended)

Currently the invite in `PropertySettingsTab.tsx` does:
```js
supabase.from('property_members').insert({
  user_id: user.id,  // ← This is wrong — sets it to the inviter's ID
  email: inviteEmail,
  status: 'pending'
})
```

Fix: Change `user_id` to be nullable (or a placeholder) until the invitee accepts. Then on first login, auto-link pending invites to the new user's `auth.uid()`.

---

## What TJ, Erika & Mike's Experience Would Look Like

```text
TJ signs up with CITISIGNALFUERTES
  └─ Adds all Fuertes Management buildings
  └─ Goes to each property → Settings → Team → Invites erika@... and mike@...

Erika signs up with CITISIGNALFUERTES
  └─ Logs in → System detects pending invites for her email
  └─ Invites auto-accepted → Dashboard shows all shared buildings
  └─ Can see all violations, work orders, compliance — read access

Mike does the same
  └─ All three now see identical dashboards for Fuertes Management
```

---

## Scope of Changes

| Area | Change |
|---|---|
| Database migration | New `is_property_member()` function + updated RLS on 8-10 tables |
| `property_members` table | Fix `user_id` nullable + pending invite insert logic |
| Auth flow / Onboarding | Auto-link pending invites on first login |
| `PropertiesPage.tsx` | Add "Shared" badge for non-owned properties |
| `PropertySettingsTab.tsx` | Fix invite insert (user_id placeholder) |

---

## Important Note for the Beta Test

For TJ, Erika, and Mike specifically — the fastest path for this weekend:

**Have ONE of them (TJ) add all the Fuertes properties, then invite the other two from each property's Settings tab.** Once this feature is built, Erika and Mike's dashboards will automatically populate with the shared buildings when they log in and accept their invites.

This is a meaningful feature — probably a 2-3 hour build — but it's the right architecture and will make CitiSignal genuinely useful for any company with multiple people managing the same portfolio.
