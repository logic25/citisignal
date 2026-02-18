

# Fix: Work Order Approval Flow + Communication Thread via Telegram

## Bug Fix: Approve/Counter/Reject Not Showing

**Root Cause**: Line 608 in `WorkOrdersPage.tsx` requires BOTH `status === 'quoted'` AND `quoted_amount != null`. When you change the status dropdown to "quoted", only the status updates -- no amount is set.

**Fix**: When the status is changed to "quoted" via the dropdown, prompt the user to enter a quote amount inline. Also, show the approval UI even without an amount (allow entering the amount manually).

Changes to `WorkOrdersPage.tsx`:
- When status dropdown changes to `quoted`, show an inline input for the quote amount
- Show the approval banner for ANY work order with status `quoted`, with or without an amount
- If no amount yet, show a "Enter quote amount" input inside the banner before Approve becomes available

---

## Communication Thread: Telegram (not SMS)

You're right -- the communication thread should tie into the existing Telegram integration and future WhatsApp, not SMS (since phone number costs are uncertain).

Changes:
- Update `work-order-followup` edge function to use `send-telegram` instead of `send-sms`
- Update the vendor dispatch flow to send via Telegram/WhatsApp instead of SMS
- The `work_order_messages` table already has a `channel` column that supports `telegram`/`whatsapp`/`in_app`, so no schema change needed
- When a vendor responds via Telegram webhook, the `telegram-webhook` function will be updated to detect vendor messages and extract quotes (same AI logic currently in `sms-webhook`)

---

## Feature Roadmap Clarification

Based on your feedback, here is the updated priority list:

| Feature | Priority | Notes |
|---------|----------|-------|
| Online Rent Collection | High | Stripe integration for tenant payments |
| Tenant Portal | High | Self-service portal for tenants (pay rent, submit requests) |
| One-Click Push to LoopNet/Crexi | High | Vacancy marketing for commercial listings |
| Owner Statements | Critical | Monthly P&L per property for owners |
| CAM Charges & Budgets | High | Common Area Maintenance tracking and reconciliation |
| Reports Builder | Medium | Custom report generation |
| Email Templates & Blasts | Medium | Templated emails to tenants/vendors |
| Check Scanning | Medium | Deposit check capture and recording |
| Roles & Permissions | Medium | Granular user access control |
| Automatic Actions | Low | We partially have this with follow-ups; expand triggers |
| E-Signatures | Deferred | Not critical for CRE -- most leases go through attorneys |

Documents section already exists, so no gap there.

---

## Technical Changes (This Implementation)

### 1. Fix `WorkOrdersPage.tsx` -- Approval flow visibility

- Remove the `quoted_amount != null` requirement from the conditional
- When status = `quoted` and no amount, show an editable amount input + Save button
- Once amount is saved, show Approve/Counter/Reject as before
- Add a "Set Quote" inline action on the status dropdown change

### 2. Update `work-order-followup/index.ts` -- Use Telegram

- Replace `send-sms` calls with `send-telegram` calls
- Look up vendor Telegram chat IDs instead of phone numbers
- Fall back to in-app notification if no Telegram linked

### 3. Update `telegram-webhook/index.ts` -- Vendor quote detection

- Add vendor detection logic (same pattern as sms-webhook):
  - Match sender Telegram ID against vendors table
  - Find open/dispatched work orders for that vendor
  - Extract dollar amounts from messages via AI
  - Update work order status to `quoted` and set `quoted_amount`
  - Create `work_order_messages` entry
  - Notify owner via notification

### 4. Remove SMS dispatch from work order UI

- Replace "Dispatch via SMS" buttons with "Dispatch via Telegram"
- Keep the multi-vendor dispatch workflow intact, just change the channel

