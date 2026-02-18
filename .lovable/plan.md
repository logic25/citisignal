
# Simulate Vendor Signing + View Executed PO + Payment Flow

## What This Covers

1. **"Simulate Vendor Sign" button** on the work order expanded view so you can test the full cycle without Telegram
2. **Fully Executed PO view** inline on the work order row showing both signatures, amount, PO number, and a "View PO" link
3. **Completion + Payment flow** -- the industry-standard PM pattern:
   - Vendor marks work "complete" and uploads photos
   - Owner reviews completion photos and approves
   - Payment triggered (Zelle info displayed or Stripe payout)

---

## 1. Simulate Vendor Sign Button

In `WorkOrdersPage.tsx`, when a work order has status `approved` and has a `po_id`:
- Add a **"Simulate Vendor Sign"** button (dev/test only) that:
  - Fetches the PO by `po_id`
  - Sets `vendor_signed_at = now()` and `status = 'fully_executed'`
  - Updates the work order status to `in_progress`
  - Refreshes the UI
- This mimics what happens when a vendor clicks the sign link or texts "ACCEPT PO-XXXXX"

## 2. Fully Executed PO Display

When work order has `po_id` and PO is `fully_executed`:
- Show a green card in the expanded row with:
  - PO Number
  - Amount
  - Owner signed date
  - Vendor signed date
  - Status badge: "Fully Executed"
  - Link to view the full PO page (`/sign-po/:token`)
- The PO lives in the `purchase_orders` table and is viewable on the `/sign-po/:token` route (already built)

## 3. Completion + Payment Flow (Industry Standard)

The standard property management completion flow:
1. Work order status moves from `in_progress` to `awaiting_docs`
2. Vendor uploads completion photos (via Telegram or a completion link)
3. Owner reviews photos and marks "Work Verified"
4. Status moves to `completed`
5. Payment is released

### Database Changes

Add columns to `work_orders`:
- `completion_photos` (jsonb) -- array of photo URLs
- `completion_notes` (text) -- vendor's completion notes
- `completed_at` (timestamptz) -- when vendor marked complete
- `verified_at` (timestamptz) -- when owner verified
- `payment_method` (text) -- 'zelle', 'stripe', 'check', 'other'
- `payment_status` (text) -- 'pending', 'processing', 'paid'
- `payment_reference` (text) -- Zelle confirmation, Stripe ID, check number
- `paid_at` (timestamptz)

Add columns to `vendors`:
- `zelle_email` (text) -- for Zelle payments
- `zelle_phone` (text) -- alternate Zelle identifier
- `payment_preference` (text) -- 'zelle', 'stripe', 'check'

### UI Changes in WorkOrdersPage.tsx

**For `in_progress` work orders:**
- Show a "Mark Complete" button that opens a dialog for uploading completion photos and notes
- Status changes to `awaiting_docs`

**For `awaiting_docs` work orders:**
- Display uploaded photos in a grid
- Show "Verify & Pay" button
- Verify button opens payment dialog:
  - Shows vendor's preferred payment method
  - For Zelle: displays vendor's Zelle email/phone, field for confirmation number
  - For Stripe: future integration hook
  - For Check: field for check number
- On confirm: status to `completed`, `payment_status` to `paid`

### File Changes Summary

| File | Change |
|------|--------|
| `WorkOrdersPage.tsx` | Add simulate sign button, PO display card, completion flow UI, payment dialog |
| Migration SQL | Add completion/payment columns to work_orders, payment info to vendors |
| `src/integrations/supabase/types.ts` | Auto-updates with new columns |

### Storage

Completion photos will be stored in a new `work-order-photos` storage bucket (public for vendor upload links, RLS for owner access).
