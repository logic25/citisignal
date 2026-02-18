
# Work Order Intelligence: Smart Dispatch, Vendor Quotes, and Follow-Up Automation

## The Problem Today

The current work order system is bare-bones: scope, status dropdown, optional vendor/violation link. It's missing the real-world workflows you described:

1. **No intelligence for finding the right vendor** -- when a leak happens, you manually scroll through roofers
2. **No quote/pricing tracking** -- vendors text back prices, but there's nowhere to capture that
3. **No approval workflow** -- no way to accept/reject a quote before work begins
4. **No follow-up automation** -- work orders sit in "open" with no nudges
5. **No communication thread** -- vendor replies via SMS/WhatsApp don't connect back to the work order

---

## What We're Building

### 1. Smart Vendor Matching ("Find me a roofer")

When creating a work order, instead of manually picking a vendor, you'll see a **"Find Vendor" button** that:
- Filters your vendor list by **trade type** matching the issue (e.g., "Roofer" for a leak)
- Sorts by **most recent completed work** at this property (familiarity)
- Shows **COI status** inline so you don't pick an expired vendor
- Allows **multi-dispatch**: send the same work order to 2-3 vendors at once for competitive quotes

### 2. Quote/Bid Tracking on Work Orders

New columns on `work_orders`:
- `quoted_amount` -- the price the vendor comes back with
- `approved_amount` -- what you approve
- `approved_at` -- when you approved
- `approved_by` -- who approved
- `priority` -- urgent/normal/low
- `due_date` -- when the work should be done by
- `notes` -- internal notes / communication log

New status values added to the workflow:
```
open -> dispatched -> quoted -> approved -> in_progress -> awaiting_docs -> completed
```

- **dispatched** = sent to vendor(s), waiting for quote
- **quoted** = vendor replied with a price
- **approved** = owner approved the price, work can begin

### 3. Inbound Quote Capture via SMS/WhatsApp

When a vendor texts/WhatsApps back with a price (e.g., "I can do it for $2,500"), the AI in the SMS/WhatsApp webhook will:
- Detect it's a vendor response (match the sender's phone to a vendor in the database)
- Find their **open/dispatched work order**
- Extract the dollar amount from the message
- Update the work order with `quoted_amount` and change status to `quoted`
- Notify the owner: "Vendor ABC quoted $2,500 for roof repair at 123 Main St. Approve?"

This uses the existing `sms-webhook` and the new `whatsapp-webhook` -- just adding vendor-detection logic.

### 4. Approval Flow in the UI

On the work order card, when status is `quoted`:
- Show the quoted amount prominently
- **Approve** button (sets `approved_amount = quoted_amount`, status -> `approved`, notifies vendor via SMS/WhatsApp: "Your quote has been approved. Please proceed.")
- **Counter** button (lets you enter a different amount, sends to vendor)
- **Reject** button (status -> `open`, notifies vendor)

### 5. Follow-Up Intelligence

A new edge function `work-order-followup` (called by the existing scheduled-sync pattern):
- Work orders in `dispatched` for over 24 hours with no vendor response -- send a follow-up SMS/WhatsApp
- Work orders in `approved` for over 48 hours with no status change -- nudge vendor
- Work orders in `in_progress` for over 7 days -- flag for owner review
- All follow-ups logged to the work order's notes

---

## Technical Details

### Database Migration

**Alter `work_orders` table** -- add new columns:
- `quoted_amount NUMERIC`
- `approved_amount NUMERIC`
- `approved_at TIMESTAMPTZ`
- `approved_by UUID`
- `priority TEXT DEFAULT 'normal'`
- `due_date DATE`
- `notes TEXT`
- `dispatched_at TIMESTAMPTZ`
- `vendor_notified_via TEXT` (sms/whatsapp/email)

**Alter work_order_status enum** -- add `dispatched`, `quoted`, `approved` values

**New table: `work_order_messages`** -- communication thread per work order:
- `id UUID PRIMARY KEY`
- `work_order_id UUID REFERENCES work_orders`
- `sender_type TEXT` (owner/vendor/system)
- `sender_name TEXT`
- `channel TEXT` (sms/whatsapp/in_app)
- `message TEXT`
- `extracted_amount NUMERIC` (if AI detected a quote)
- `created_at TIMESTAMPTZ`

RLS: same property-based policy pattern as work_orders.

### Edge Function Changes

**`sms-webhook/index.ts`** -- add vendor detection:
1. Check if sender phone matches any vendor's `phone_number`
2. If yes, find their open work orders
3. Use AI to extract quote amount from message
4. Update work order and create `work_order_messages` entry
5. Notify owner

**`whatsapp-webhook/index.ts`** (new, Phase 2) -- same vendor detection logic

**`work-order-followup/index.ts`** (new) -- scheduled follow-up:
- Query work orders by status and age
- Send follow-up messages via appropriate channel
- Log follow-ups

### UI Changes

**`PropertyWorkOrdersTab.tsx`** -- enhanced work order cards:
- Priority badge (urgent = red, normal = blue, low = gray)
- Due date display
- Quoted/approved amount display
- Approve/Counter/Reject buttons when status is `quoted`
- Communication thread (expandable section showing `work_order_messages`)
- "Find Vendor" smart matching when creating

**`WorkOrdersPage.tsx`** -- add filters for:
- Priority filter
- "Needs Attention" filter (overdue follow-ups)

**`CreateWorkOrderDialog.tsx`** -- add:
- Priority selector
- Due date picker
- Multi-vendor dispatch (checkboxes to send to multiple vendors)
- "Find Vendor" that auto-filters by trade type

### Implementation Order

| Step | What | Details |
|------|------|---------|
| 1 | Database migration | Add columns to work_orders, new status values, create work_order_messages table |
| 2 | UI: Enhanced work order cards | Priority, due date, quote display, approve/reject flow |
| 3 | UI: Smart vendor matching | Trade-type filter, COI status, multi-dispatch |
| 4 | SMS webhook: Vendor quote detection | Match vendor phone, extract amount, update work order |
| 5 | Follow-up edge function | Scheduled nudges for stale work orders |
| 6 | WhatsApp webhook (Phase 2) | Same vendor detection as SMS |
