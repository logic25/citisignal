
# Invite-Only Signup System

## What This Does

Locks down account creation so only people you personally give a code to can sign up. Anyone can still visit the landing page and sign in to an existing account — but creating a new account requires a valid invite code that you control.

## How It Works

```text
Landing Page (public)
       |
  Click "Get Started"
       |
  Auth Page - Sign Up tab
       |
  [Email] [Password] [Invite Code]  <-- new field
       |
  Backend validates code exists & is unused
       |
  Valid?  --> Create account --> Onboarding
  Invalid? --> "Invalid invite code" error
```

## What Gets Built

### 1. Database — `invite_codes` table
A new table to store your invite codes with these fields:

| Column | Description |
|---|---|
| `code` | The code itself (e.g. `CITIBETA`, `FRIEND2026`) |
| `created_by` | Your admin user ID |
| `used_by` | The user ID that redeemed it (null until used) |
| `used_at` | Timestamp when redeemed |
| `max_uses` | How many times the code can be used (default: 1) |
| `use_count` | How many times it has been used |
| `expires_at` | Optional expiration date |
| `is_active` | Toggle to disable a code |

RLS policies ensure:
- Only admins can create/view/deactivate codes
- The validation check during signup is done server-side via an Edge Function (so the code list is never exposed to the browser)

### 2. Edge Function — `validate-invite-code`
A secure backend function that:
1. Receives the invite code + new user's email
2. Checks the code exists, is active, not expired, and has remaining uses
3. If valid: creates the account and marks the code as used
4. If invalid: returns an error — the account is never created

This keeps invite code validation 100% server-side. Users cannot bypass it from the browser.

### 3. Auth Page — Invite Code Field
When a visitor switches to "Sign Up" mode, a new "Invite Code" field appears. The existing Sign In flow is completely unchanged. Google Sign-In will also require an invite code on first sign up.

### 4. Admin Panel — Invite Codes Tab
A new tab added to your existing Admin Panel (`/dashboard/admin`) where you can:
- **Create new codes** — single-use or multi-use, with optional expiry
- **See all codes** — which are active, used, by whom, and when
- **Deactivate codes** — instantly revoke a code if needed

You could create codes like:
- `FRIEND1`, `FRIEND2`, `FRIEND3` (one per person, single-use)
- `BETATEAM` (multi-use, for a small group)
- `CITISIGNAL2026` (share broadly but set a limit of 10 uses)

## Technical Notes
- Invite code validation happens entirely in the backend — the list of valid codes is never sent to the browser
- Codes are case-insensitive (so `friend1` and `FRIEND1` both work)
- The `user_roles` table (already in place) controls admin access to the Invite Codes tab
- No changes to the existing sign-in flow or password reset flow
- Google OAuth sign-ups will redirect back to the auth page prompting for an invite code before the account is finalized
