
# Roadmap Overhaul: Competitive Positioning vs SiteCompli and Jack Jaffa

## Why This Matters

Right now the public roadmap on the landing page shows 8 "Live" items, 4 "In Progress," and 4 "Future." But it doesn't tell the story of **why someone should switch**. The roadmap needs to double as a competitive positioning tool — showing what CitiSignal already does that SiteCompli charges $300+/building/month for, and what's coming that neither competitor offers.

## Current State

**Email Notifications**: Fully built. The `send-email-digest` edge function sends property-grouped weekly/daily digests via Resend with severity-classified violation cards, hearing alerts, expiring docs, and application updates. Users control frequency and content in Settings > Email Preferences. Individual sequential sending (no CC/BCC). Working end-to-end.

**WhatsApp**: Not built. The Twilio WhatsApp Sandbox has not been activated. The only code references are placeholder "coming soon" labels in the landing page (Hero, Features, HowItWorks, VendorDispatch). No webhook, no edge function, no bot logic exists. To build it, you need: (1) Twilio WhatsApp Sandbox activated, (2) a `whatsapp-webhook` edge function mirroring `telegram-webhook`, (3) phone number linking in Settings.

**Current Roadmap Items in DB** (what's shown on the public site):

| Phase | Items |
|---|---|
| Live (8) | Core violation tracking, 6-agency sync, SMS/Telegram alerts, A-F scoring, Lease Q&A AI, Work orders/vendors, CO detection, Help Center |
| In Progress (4) | WhatsApp bot, OATH hearing/penalty sync, SWO/Vacate refinement, TCO expiration alerts |
| Next Up (0) | Empty — nothing in this phase |
| Future (4) | Portfolio analytics, Google Calendar sync, White-label, Enhanced RAG |

## The Problem

1. The roadmap doesn't mention **half of what's actually live** (email digests, Telegram AI bot, vendor dispatching, compliance calendar, tenant management, insurance tracking, tax module, document management, org/team accounts)
2. "Next Up" is empty — signals no near-term momentum
3. Missing features that would directly counter SiteCompli/Jack Jaffa aren't listed
4. No competitive framing — a prospect comparing you to SiteCompli sees a short feature list

## Plan: Update Roadmap Items in Database

### New "Live" Items to Add (things already built but not on roadmap)

| Title | Why It Matters vs Competitors |
|---|---|
| Email compliance digests (daily/weekly) | SiteCompli charges extra for alerts. Yours is included. |
| Telegram AI property bot | Neither competitor has AI-powered messaging. |
| Vendor dispatch via Telegram | SiteCompli has no messenger-based vendor workflow. |
| Compliance calendar with deadline reminders | Direct SiteCompli feature parity. |
| Tenant & lease management | Expanding beyond pure compliance — PM territory. |
| Insurance/COI tracking with expiration alerts | Jack Jaffa charges separately for this. |
| Tax assessment & exemption tracking | Neither competitor bundles tax data. |
| Document management with expiration alerts | Core feature, not listed. |
| Team/organization accounts | Multi-user orgs with invite codes — just shipped. |
| In-app notification center with priority routing | Real-time bell + date-grouped history. |
| AI property chat (per-property intelligence) | Unique differentiator. No competitor has this. |
| Purchase order generation & e-signature | End-to-end work order lifecycle. |

### Move/Update "In Progress" Items

Keep as-is — WhatsApp, OATH sync, SWO refinement, TCO alerts are accurate.

### New "Next Up" Items (fill the empty phase)

| Title | Strategic Rationale |
|---|---|
| Owner entity resolution (ACRIS integration) | The "B-level" intelligence discussed in audit — links properties by owner |
| Penalty exposure calculator | Dollar-amount risk per violation — underwriting language |
| Historical violation trend lines | "Getting better or worse" — key for portfolio managers |
| Portfolio-wide compliance dashboard | Aggregate scores, violation density, trend comparison across buildings |

### Keep "Future" Items

Google Calendar sync, White-label, Enhanced RAG stay. Add:

| Title | Why |
|---|---|
| Predictive compliance risk scoring | Needs 18-24 months of stored data first |
| ACRIS deed/mortgage integration | Underwriting-grade title data layer |
| API access for enterprise integrations | API-first architecture for data consumers |

## Technical Implementation

### Step 1: Database Updates
Insert ~12 new roadmap items into the `roadmap_items` table for "Live" phase, 4 for "Next Up," and 3 for "Future." Reorder `sort_order` values so the most impressive/differentiating features appear first within each phase.

### Step 2: Update Landing Page Stats Bar
The stats bar in `Roadmap.tsx` currently shows:
- 9 NYC Agencies Monitored
- 3 Messaging Channels
- A-F Compliance Grading
- 24/7 Automated Sync

Update to reflect actual scale:
- **9** NYC Agencies
- **20+** Live Features
- **A-F** Compliance Grading
- **3** Alert Channels (Email, SMS, Telegram)

### Step 3: Add Roadmap Section to Landing Page
The Roadmap component exists (`src/components/landing/Roadmap.tsx`) but is **not rendered** in `Index.tsx`. Add it to the landing page between LeaseQA and CTA sections so prospects can actually see it.

### Step 4: WhatsApp Status
Mark WhatsApp as "In Progress" (accurate — architecture is designed, awaiting Twilio sandbox activation). No code changes needed for WhatsApp until sandbox is live.

## What This Gives You in a Sales Conversation

When someone asks "why leave SiteCompli?":

- **20+ live features** vs their basic violation monitoring
- **AI-powered property intelligence** — they have none
- **Telegram/SMS/Email alerts included** — SiteCompli charges per channel
- **Vendor dispatch + work orders + POs** — end-to-end workflow
- **Tenant, insurance, tax management** — they don't offer this
- **Team accounts with invite codes** — simpler than their enterprise onboarding
- **Free during beta** — they charge $300+/building/month

The roadmap also shows a clear trajectory toward **owner intelligence and portfolio analytics** — features that would take SiteCompli years to build because their architecture isn't designed for it.
