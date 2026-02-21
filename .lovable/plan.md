
# Organization Auto-Discovery at Signup: Analysis & Plan

## Your Idea, Explained Technically

You're describing this flow:

1. TJ signs up → enters "Fuertes Management" as company name → an **organization** is created
2. Erika goes to sign up → types her email → the system detects "Fuertes Management" exists → she sees it and clicks "Join Fuertes Management"
3. Once she joins, she sees all of TJ's properties automatically

This is exactly how tools like Slack, Notion, and Linear work. It's a great UX pattern. But there are real security questions to work through.

---

## The Security Flaws in the Naive Version

Here's what goes wrong if it's implemented carelessly:

**Flaw 1 — Anyone can claim to be from Fuertes Management**

If the discovery is just "search by company name," then a random person types "Fuertes Management" during signup and gets access to all their properties and violations. Company names are guessable. This is a serious data breach risk.

**Flaw 2 — Email domain matching solves it, but only if they have a real domain**

The safest version of this feature works like: "If you sign up with `@fuertesmgmt.com`, you automatically see the Fuertes Management org." But this only works when the company has a custom email domain — not personal emails like `@gmail.com`, `@yahoo.com`, etc. If TJ is `tj@gmail.com`, there's no reliable domain to match on.

**Flaw 3 — Self-approval is dangerous**

If a user can discover AND join an org without any approval from the existing member, that's an open door. Even with email domain matching, the org owner should confirm new members.

---

## The Right Architecture for CitiSignal

Given that your beta testers likely use personal or mixed email addresses, the cleanest and most secure approach is a **two-model hybrid**:

### Model A — Invite-Code-Linked Organization (Recommended for Beta)

When TJ redeems `CITISIGNALFUERTES`, the system:
1. Creates TJ's account
2. Creates an **organization** called whatever name is attached to that invite code (you set this in the admin panel when creating the code — e.g. "Fuertes Management")
3. Sets TJ as the org **owner**

When Erika redeems the **same** invite code `CITISIGNALFUERTES`:
1. Creates Erika's account
2. Sees the org already exists for that code
3. Adds Erika as a **member** of "Fuertes Management" automatically
4. She logs in and sees TJ's properties

**Security:** The invite code is the gate. Only people with the correct code join the org. No guessing, no domain matching required. You already control who gets which code.

### Model B — Email Domain Auto-Join (Future, for real businesses)

When a company has `@fuertesmgmt.com`, the org owner can set "allow anyone with `@fuertesmgmt.com` to join." New signups with that domain see the org and request access. Owner approves. This is the Slack/Notion model.

---

## What Needs to Be Built for Model A

### Database Changes

Add an `organizations` table:
```
id, name, invite_code_id (links to the code that created it), created_by, created_at
```

Add `organization_id` to the `profiles` table so each user belongs to one org.

Update the `properties` table (or the RLS) so that members of the same organization can see each other's properties — without TJ having to manually invite Erika to every single building.

### Edge Function: `validate-invite-code`

Extend the existing function to:
1. After creating the user, check if an organization already exists for that invite code
2. If yes → add the new user to that org as a member
3. If no → create the org (using the code's `notes` field or a new `org_name` field on the invite code) and set the user as owner

### Onboarding Wizard Change

For users joining an existing org (not the first user of that code), skip the "Add Your First Property" step — they'll already see TJ's properties when they land on the dashboard.

Show a welcome screen that says: "You've joined **Fuertes Management**. You can now see all shared properties."

### Properties Page

Currently shows properties where `user_id = me`. Change to: properties where `user_id = me` OR `user_id is in same organization as me`. No manual per-property invites needed.

---

## Scope of Changes

| Area | What Changes |
|---|---|
| Database | New `organizations` table; `organization_id` added to `profiles`; updated RLS on `properties` |
| `invite_codes` table | Add optional `org_name` column (what to name the org when first redeemed) |
| `validate-invite-code` edge function | Auto-create or auto-join org based on the invite code |
| `OnboardingWizard.tsx` | Detect if user is joining existing org; show "joined org" message instead of "add property" |
| `PropertiesPage.tsx` | Fetch properties across org members, not just current user |
| Admin Panel | Add `org_name` field when creating invite codes |

---

## How This Solves the Fuertes Scenario

- You create one invite code `CITISIGNALFUERTES` with `org_name: "Fuertes Management"` and `max_uses: 3`
- TJ signs up first → "Fuertes Management" org is created, TJ is owner
- TJ adds all the buildings during onboarding
- Erika and Mike sign up with the same code → automatically join "Fuertes Management" → instantly see TJ's buildings, violations, and compliance data
- No manual property-by-property invites needed

---

## Security Summary

| Risk | How It's Mitigated |
|---|---|
| Random person joins org | Only possible with the invite code — which you control |
| Invite code leaked | Codes have a `max_uses` limit — once TJ, Erika, and Mike use it, it's closed |
| One org member sees another's personal data | RLS policies only expose properties, violations, etc. — not passwords, billing, or personal account settings |
| Rogue member added to wrong org | The code is the single gate; org membership is set server-side in the edge function |

This is the right long-term architecture and it maps cleanly onto what you already have. It's a meaningful build (~3-4 hours) but it eliminates the manual per-property invite friction entirely.
