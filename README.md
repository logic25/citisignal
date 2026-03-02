# CitiSignal

NYC property compliance management platform. Monitor DOB/ECB/HPD violations, track building permits, manage compliance deadlines, and generate due diligence reports — all from one dashboard.

## Features

### Core
- **Property Management** — Add NYC properties by address; auto-populates building data from PLUTO + DOB Jobs datasets
- **Violation Tracking** — Syncs DOB, ECB, HPD, FDNY violations from NYC Open Data with severity classification and aging
- **Compliance Scoring** — Automated A–F grading based on open violations, overdue filings, and resolution speed
- **Due Diligence Reports** — Generate comprehensive property reports with violations, applications, and AI analysis
- **Work Orders** — Create and track remediation work linked to specific violations and vendors
- **Purchase Orders** — Generate POs with e-signature workflow for vendor approval
- **Document Management** — Upload leases, permits, COIs with expiration tracking and AI-powered Q&A
- **Tenant & Lease Management** — Track tenants, lease terms, insurance requirements, and tags
- **Insurance/COI Tracking** — Monitor certificate expirations with automated alerts
- **Tax Assessment & Exemptions** — Track property taxes, installments, protests, and exemption programs
- **CAM Reconciliation** — Common area maintenance budgets with tenant allocation
- **Compliance Calendar** — Deadline reminders for local law filings and inspections
- **AI Property Chat** — Per-property AI assistant with full context on violations, applications, and building data
- **Portfolios** — Group properties for aggregate compliance views
- **Report Builder** — Custom reports with configurable data sources, filters, and scheduling
- **Notifications** — Real-time in-app alerts with priority routing and date-grouped history

### Communication
- **Email Digests** — Configurable weekly/daily summary emails via Resend with severity-classified violation cards
- **Email Work Order Notifications** — Vendors receive email when assigned a new work order
- **Telegram Bot** — AI-powered bot for property queries, violation alerts, and vendor dispatch
- ~~**SMS Alerts**~~ — _Disabled (2026-03-02)._ Twilio SMS integration exists but is turned off. Edge function returns a soft "disabled" response. See `supabase/functions/send-sms/index.ts`.
- ~~**WhatsApp Bot**~~ — _Disabled (2026-03-02)._ Full implementation preserved in git history. See `supabase/functions/whatsapp-webhook/index.ts`.
- ~~**SMS Webhook**~~ — _Disabled (2026-03-02)._ Inbound SMS handler preserved in git history. See `supabase/functions/sms-webhook/index.ts`.

> **Why disabled?** SMS and WhatsApp require Twilio infrastructure costs (phone numbers, per-message fees). The security audit also identified missing Twilio request signature validation on the webhook endpoints. These will be re-enabled once signature validation is added and messaging costs are budgeted. See each edge function's header comments for re-enablement steps.

### Admin Panel
- **API Health Dashboard** — Real-time monitoring of NYC Open Data API endpoints with status, latency, and error tracking
- **User Management** — View all users, their properties, violation counts, AI usage, and DD report activity
- **User Detail** — Deep dive into any user's account with property list and usage metrics
- **Role System** — Secure `user_roles` table with `has_role()` security-definer function (no privilege escalation)
- **Invite Codes** — Organization-scoped invite codes for controlled onboarding

## Authentication Flow

- **New Users**: Must register using email, password, and an invite code. This creates the account, profile, and organization membership.
- **Returning Users**: Can use Google Sign-In as a convenience once their account exists. OAuth users without an existing organization are rejected with a toast message.
- Email confirmation is required before sign-in (Lovable Cloud auth setting).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, shadcn/ui |
| State | TanStack React Query |
| Routing | React Router v6 |
| Backend | Lovable Cloud (Supabase) |
| Auth | Email/password + Google OAuth with RLS |
| Edge Functions | Deno (violation sync, AI, email, Telegram) |
| Charts | Recharts |
| Email | Resend |
| Messaging | Twilio _(currently disabled)_ |

## Project Structure

```
src/
├── components/
│   ├── auth/              # ProtectedRoute
│   ├── dashboard/         # Layout, sidebar, stats cards, AI chat
│   ├── dd-reports/        # Due diligence report components
│   ├── helpdesk/          # Bug reports, feature requests, AI usage
│   ├── landing/           # Marketing pages (Hero, Features, Roadmap, etc.)
│   ├── lease/             # Lease Q&A chat
│   ├── onboarding/        # Onboarding wizard
│   ├── portfolios/        # Portfolio management
│   ├── properties/        # Property CRUD, detail tabs, address autocomplete
│   ├── settings/          # Email, Telegram, WhatsApp (disabled) preferences
│   ├── tour/              # Product tour
│   ├── ui/                # shadcn/ui components
│   └── violations/        # Work order creation
├── hooks/
│   ├── useAuth.tsx         # Auth context provider (includes OAuth gate)
│   ├── useAdminRole.ts     # Admin role check hook
│   ├── useComplianceScore.ts
│   ├── useNotifications.ts
│   └── usePropertyAIChat.ts
├── lib/
│   ├── api-logger.ts       # NYC API call logging wrapper
│   ├── nyc-building-sync.ts # PLUTO + DOB data sync
│   ├── violation-severity.ts
│   ├── violation-aging.ts
│   ├── local-law-engine.ts  # Compliance requirement engine
│   └── complaint-category-decoder.ts
├── pages/
│   ├── dashboard/
│   │   ├── admin/          # Admin panel pages
│   │   ├── DashboardOverview.tsx
│   │   ├── PropertiesPage.tsx
│   │   ├── ViolationsPage.tsx
│   │   ├── WorkOrdersPage.tsx
│   │   ├── VendorsPage.tsx
│   │   ├── TenantsPage.tsx
│   │   ├── TaxesPage.tsx
│   │   ├── InsurancePage.tsx
│   │   ├── CAMPage.tsx
│   │   ├── DDReportsPage.tsx
│   │   ├── ReportBuilderPage.tsx
│   │   └── ...
│   ├── Auth.tsx
│   ├── ResetPassword.tsx
│   ├── SignPO.tsx
│   └── Index.tsx
└── integrations/
    └── supabase/           # Auto-generated client & types

supabase/
└── functions/
    ├── fetch-nyc-violations/   # Violation sync from NYC Open Data
    ├── property-ai/            # AI property assistant
    ├── lease-qa/               # Lease document Q&A
    ├── generate-dd-report/     # DD report generation
    ├── generate-po/            # Purchase order PDF generation
    ├── sign-po/                # PO e-signature handler
    ├── send-email-digest/      # Scheduled email summaries
    ├── send-work-order-notification/ # Email notification to vendors
    ├── send-sms/               # ⚠️ DISABLED — Twilio SMS (returns soft error)
    ├── sms-webhook/            # ⚠️ DISABLED — Inbound SMS handler
    ├── whatsapp-webhook/       # ⚠️ DISABLED — WhatsApp bot webhook
    ├── send-telegram/          # Telegram notifications
    ├── telegram-webhook/       # Telegram bot webhook
    ├── scheduled-sync/         # Periodic data refresh
    ├── send-change-summary/    # Change notification emails
    ├── send-invite/            # Invite code emails
    ├── extract-document-text/  # Document text extraction
    ├── analyze-telemetry/      # Usage analytics
    ├── admin-get-users/        # Admin user listing
    ├── admin-delete-user/      # Admin user deletion
    ├── validate-invite-code/   # Invite code validation
    └── work-order-followup/    # Work order follow-up notifications
```

## Database Schema

### Key Tables
- `properties` — Building records with 80+ fields from PLUTO/DOB
- `violations` — DOB/ECB/HPD violations with severity, status, penalties
- `applications` — DOB job applications and permits
- `oath_hearings` — OATH hearing results linked to violations
- `compliance_requirements` — Local law filings with deadlines
- `compliance_scores` — Calculated A–F grades per property
- `work_orders` — Remediation tasks linked to violations/vendors
- `purchase_orders` — POs with vendor e-signature workflow
- `property_documents` — Uploaded files with extracted text
- `tenants` — Tenant records with lease terms and insurance
- `property_taxes` — Tax assessments, installments, and protests
- `tax_exemptions` — Tax exemption programs (421-a, ICAP, etc.)
- `cam_budgets` / `cam_line_items` / `cam_tenant_allocations` — CAM reconciliation
- `financial_transactions` — Income/expense tracking
- `notifications` — In-app alerts with priority levels
- `change_log` — Property change tracking for digest emails
- `email_preferences` — Per-user digest configuration
- `telegram_users` — Linked Telegram accounts
- `whatsapp_users` — Linked WhatsApp accounts _(table exists but feature disabled)_
- `vendors` — Vendor directory with trade specialties
- `portfolios` — Property groupings
- `dd_reports` — Due diligence report data and AI analysis
- `report_templates` / `report_runs` — Custom report builder
- `user_roles` — Role-based access (admin/user)
- `organizations` / `invite_codes` — Multi-tenant org system
- `profiles` — User profiles with company info
- `api_call_logs` — NYC Open Data API call metrics
- `admin_audit_log` — Admin action tracking
- `ai_usage` / `ai_usage_logs` — AI token usage tracking
- `bug_reports` / `feature_requests` — Help center submissions
- `roadmap_items` — Public roadmap content

### Security
- Row Level Security (RLS) on all tables
- Users only see their own data
- Admin access via `has_role()` security-definer function (prevents RLS recursion)
- API log inserts open to all authenticated users; reads restricted to admins
- OAuth gate: Google Sign-In users without an existing org are rejected (prevents signup bypass)

## NYC Open Data Endpoints

| Dataset | ID | Status |
|---------|-----|--------|
| PLUTO | `64uk-42ks` | ✅ Active |
| DOB Jobs | `ic3t-wcy2` | ✅ Active |
| ECB Violations | `3h2n-5cm9` | ✅ Active |
| OATH Hearings | `jt7v-77mi` | ✅ Active |
| PAD | `bc8t-ecyu` | ❌ 403 (Feb 2026) |

All API calls are logged via `loggedFetch()` in `src/lib/api-logger.ts` and viewable in the admin panel at `/dashboard/admin/api-logs`.

## Environment Variables

Managed automatically by Lovable Cloud:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

### Edge Function Secrets
- `SUPABASE_SERVICE_ROLE_KEY`
- `LOVABLE_API_KEY` — AI features (Gemini via Lovable AI Gateway)
- `RESEND_API_KEY` / `RESEND_FROM_ADDRESS` — Email delivery
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` — _(configured but features disabled)_
- `TELEGRAM_BOT_TOKEN` — Telegram bot
- `APP_URL` — Base URL for email links

## Disabled Features (2026-03-02)

| Feature | Edge Function | Status | Re-enable Steps |
|---------|--------------|--------|-----------------|
| SMS Alerts | `send-sms` | Soft-disabled (returns 200 + error msg) | Remove early-return, add Twilio sig validation |
| SMS Webhook | `sms-webhook` | Disabled (returns empty TwiML) | Add Twilio sig validation, remove early-return |
| WhatsApp Bot | `whatsapp-webhook` | Disabled (returns empty TwiML) | Add sig validation, fix Base64 link codes, remove early-return |

All disabled functions have detailed header comments explaining re-enablement. The UI components (CreateWorkOrderDialog, PropertyWorkOrdersTab) handle the disabled state gracefully — SMS checkboxes are commented out, and the send-sms function returns a non-error response.

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npx vitest run

# Type check
npx tsc --noEmit
```

## Admin Setup

To grant admin access, insert a row into `user_roles`:

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('<your-user-id>', 'admin');
```

The admin panel appears in the sidebar under "Admin" with pages for API health monitoring, user management, and user detail views.

## How can I edit this code?

**Use Lovable** — Visit [Lovable](https://lovable.dev) and start prompting. Changes are committed automatically.

**Use your preferred IDE** — Clone this repo, run `npm install` && `npm run dev`. Pushed changes sync back to Lovable.

## Deployment

Open Lovable and click Share → Publish. Custom domains can be configured under Project → Settings → Domains.

## License

Private — All rights reserved.
