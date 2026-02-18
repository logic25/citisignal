

# Revised Feature Expansion Plan

## What We Already Have (No Duplication)

The current codebase already has tenant-level features scattered across modules:
- **Tenant tagging** on applications (name + notes via `TenantTagEditor`)
- **Tenant tracking** on property taxes (tenant responsible, tenant name)
- **Lease AI Q&A** with document-specific conversations and citations
- **Property AI chat** as a collaborative team notebook (with Telegram cross-posting)
- **Telegram bot** for property queries, violation lookups, and lease Q&A
- **SMS webhook** for inbound property queries via Twilio

Phase 1 from the previous plan overlaps with these. Instead of building a separate "tenant management" system, we should **elevate the existing tenant tags into a proper tenant directory** and add lease date tracking directly onto what we have.

---

## Revised Phase 1: Tenant Directory + Lease Dates (Upgrade, Not Rebuild)

Instead of new `units`, `tenants`, `leases`, and `rent_roll` tables, we take a lighter approach:

### Database Changes
- **`tenants` table**: company_name, contact_name, contact_email, contact_phone, property_id, unit_number, lease_start, lease_end, rent_amount, escalation_notes, renewal_option_date, security_deposit, lease_type (gross/NNN/modified gross), status (active/expired/pending), notes
- **No separate `units` or `leases` tables** -- for CRE, the tenant IS the unit occupant. Keep it flat until complexity demands otherwise.

### UI Changes
- New "Tenants" tab on PropertyDetailPage (alongside Violations, Applications, etc.)
- Tenant list with lease expiration countdown badges
- Existing `TenantTagEditor` on applications links to the tenant record
- Lease expiration alerts reuse the existing notification system (7/3/1 day pattern from `generate_deadline_reminders`)

---

## Revised Phase 2: WhatsApp Integration

WhatsApp follows the exact same architecture as the existing Telegram bot. The pattern:

### Infrastructure
- **New edge function**: `whatsapp-webhook/index.ts` -- mirrors `telegram-webhook/index.ts`
- **New edge function**: `send-whatsapp/index.ts` -- mirrors `send-telegram/index.ts`
- Uses **Twilio WhatsApp API** (same Twilio credentials already configured: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`)
- Need one new secret: `TWILIO_WHATSAPP_NUMBER` (the Twilio WhatsApp-enabled number)

### How It Works
- Twilio routes WhatsApp messages to the `whatsapp-webhook` edge function
- Same Gemini-powered AI assistant answers property queries
- Messages logged to `property_ai_messages` with a "WhatsApp" badge (same pattern as Telegram's badge)
- Account linking via `/start` deep link or manual `/link` command

### Database Changes
- **`whatsapp_users` table**: user_id, phone_number, is_active, linked_at (mirrors `telegram_users`)

### Settings UI
- New "WhatsApp" section in Settings page alongside existing Telegram tab
- Shows linking status, phone number, and unlink button

---

## Revised Phase 3: Financial Tracking with QuickBooks

For CRE financial tracking, **QuickBooks integration is the right move** rather than building a full accounting system. Two options:

### Option A: QBO (QuickBooks Online) API -- Recommended
- Direct API integration via OAuth2
- Real-time sync of income/expenses
- Automatic categorization by property
- Requires: QBO API credentials (Client ID + Client Secret)
- **New edge function**: `qbo-sync/index.ts` for fetching transactions
- **New table**: `qbo_connections` (user_id, realm_id, access_token, refresh_token)
- **New table**: `transactions` (property_id, amount, category, date, qbo_reference_id, description, vendor)
- UI: Financial tab on PropertyDetailPage showing synced transactions, P&L summary

### Option B: CSV/IIF Import (QuickBooks Desktop)
- Manual upload workflow: user exports CSV/IIF from QBD, uploads to the app
- **New edge function**: `parse-qbd-export/index.ts` to parse CSV/IIF format
- Same `transactions` table as above, but `source: 'qbd_import'` instead of `'qbo_sync'`
- UI: Import button on Financials page with drag-and-drop upload

### Recommendation
Support **both** -- QBO as primary with live sync, plus CSV import as fallback for QBD users. Many CRE managers use QBD, so CSV import is essential. The `transactions` table is the same either way; only the data source differs.

---

## Revised Pricing (Adjusted for Overlap)

### Starter -- $49/month
- Up to 5 properties
- Violation monitoring (DOB, ECB, HPD, FDNY, DEP, DOT, DSNY, DCA, SBS)
- Compliance scoring and calendar
- Application/permit tracking
- Document uploads (5 GB)
- Email notifications
- 1 user

### Professional -- $149/month
- Up to 25 properties
- Everything in Starter plus:
- Tenant directory with lease tracking
- Lease AI Q&A (50 questions/month)
- Work orders and vendor management
- SMS + Telegram + WhatsApp alerts
- Due diligence reports (10/month)
- 25 GB document storage
- 3 users

### Enterprise -- $349/month
- Unlimited properties
- Everything in Professional plus:
- QuickBooks sync (QBO or CSV import)
- Portfolio analytics dashboard
- Insurance policy tracking
- Property AI assistant (unlimited)
- Lease AI Q&A (unlimited)
- 100 GB document storage
- Unlimited users
- Priority support

### Add-ons
- Additional properties: $5/property/month (Starter), $3/property/month (Pro)
- Additional AI questions: $0.10/question
- Additional storage: $5 per 10 GB/month
- White-label branding: $99/month

---

## Implementation Order

| Order | Feature | Effort | Why This Order |
|-------|---------|--------|----------------|
| 1 | Tenant directory + lease dates | Medium | Upgrades existing data, unlocks Pro tier |
| 2 | WhatsApp integration | Medium | Mirrors Telegram pattern, high user demand |
| 3 | QBO sync + CSV import | Large | Justifies Enterprise tier |
| 4 | Stripe subscription billing | Medium | Monetizes the tiers |
| 5 | Portfolio analytics | Medium | Enterprise differentiator |
| 6 | Insurance tracking | Small | Completeness |

---

## Technical Notes

- WhatsApp webhook reuses the same Gemini AI pipeline and `property_ai_messages` logging as Telegram
- Twilio WhatsApp API uses the same account credentials already stored -- only need the WhatsApp-specific phone number
- QBO OAuth2 tokens need refresh handling in a scheduled edge function
- CSV/IIF parsing runs entirely in an edge function with no external dependencies
- All new tables follow existing RLS pattern (user_id ownership or property_id join check)

