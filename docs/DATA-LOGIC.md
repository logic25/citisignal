# CitiSignal — Data Logic & Roadmap Review

> **Purpose**: This document captures the current logic for SWO detection, CO determination, violation processing, and application display. It's meant for the product owner to review, flag issues, and guide future iterations.

---

## 1. Certificate of Occupancy (CO) Detection

### Current Logic

The system uses a **two-tier strategy** to determine if a property has a valid CO:

#### Tier 1: DOB NOW Build Dataset
- Searches for applications with `job_type` = `NB` (New Building) or `A1` (Alteration Type 1)
- Checks if `filing_status` contains "sign off" or "co issued"
- If found → CO is valid, metadata saved

#### Tier 2: DOB BIS Jobs Dataset (Fallback)
- Fetches up to 50 jobs ordered by `latest_action_date DESC`
- Looks for NB or A1 jobs with a status indicating completion:
  - `X` = Signed Off
  - `H` = Completed
  - `I` = Signed Off (alternate code)
  - `U` = Completed (alternate code)

### Key Rule
> **Only NB and A1 job types can produce a CO.** A2 (minor alteration) and A3 never result in a new Certificate of Occupancy. If a signed-off A2 is in the system, it does NOT mean a CO exists.

### Edge Cases
- **Pre-1938 buildings**: If no CO is found and `year_built < 1938`, the system marks the property as `pre_1938` (no CO required — building predates the CO requirement).
- **Old COs**: A property may have a CO from a decades-old NB filing. The system picks the **most recent** match by ordering jobs by `latest_action_date DESC`.
- **TCOs (Temporary COs)**: Detected in DOB NOW Build via `filing_status`. If a TCO is found with an `expiration_date`, the system calculates days remaining and flags it as `temporary` with a warning severity.

### ⚠️ Open Questions for Review
1. Should we display *which* job the CO came from (e.g., "CO from NB Job #12345, signed off 2019")?
2. If multiple NB/A1 jobs exist, should we always use the most recent signed-off one?
3. Should expired TCOs automatically trigger a critical alert/notification?

---

## 2. Stop Work Order (SWO) Detection

### Current Logic

SWOs are detected from the BIS Jobs dataset using the `special_action_status` field:

| Code | Meaning |
|------|---------|
| `W` | Partial Stop Work Order |
| `S` | Full Stop Work Order |
| `R` | Partial Vacate Order |
| `V` | Full Vacate Order |
| `N` | No special action (ignored) |

### Active Status Filter

SWOs are **only** generated for jobs with active permit statuses:

| Job Status | Meaning |
|-----------|---------|
| `D` | Partial Permit |
| `E` | Permit Issued (Entire) |
| `F` | Job Closeout in Progress |

Jobs in **any other status** (pre-filing, plan exam, signed off, withdrawn, etc.) are excluded, even if they have a `special_action_status` flag. The rationale: if a job is already completed or never got a permit, the SWO is historical/moot.

### What Happens When an SWO is Detected

1. A violation record is created with:
   - `agency`: DOB
   - `violation_number`: `SWO-{job_number}`
   - `severity`: critical
   - `is_stop_work_order`: true (or `is_vacate_order` for R/V codes)
   - `source`: BIS_JOBS
2. The SWO appears as a critical violation on the property page
3. If SMS/Telegram is enabled, a notification is sent

### ⚠️ Open Questions for Review
1. **Is the active-status allowlist correct?** Currently D, E, F only. Should we include `G` (Permit Renewed)? What about `Q` (Partial Permit)?
2. **How should SWOs on plan-exam jobs (status B/C) be handled?** These mean the SWO was issued before a permit — should they still show?
3. **Should SWOs auto-resolve?** If a subsequent sync shows the `special_action_status` changed to `N`, should the SWO violation be automatically closed?
4. **DOB NOW SWOs**: Currently we only check BIS. DOB NOW Build may also have SWOs — should we add a check there?
5. **Vacate Orders (R/V)**: Should these have different handling than SWOs? They're arguably more critical since they affect occupancy.

---

## 3. Violation Processing

### Sources

| Agency | Dataset | Endpoint |
|--------|---------|----------|
| DOB | ECB Violations | `3h2n-5cm9` |
| ECB | OATH Hearings | `jt7v-77mi` |
| HPD | HPD Violations | via OATH cross-reference |
| DOB | DOB Complaints | DOB BIS |
| DOB | SWO/Vacate | BIS Jobs `special_action_status` |

### Deduplication
- Violations are keyed on `agency:violation_number`
- Existing records are updated (not duplicated) on re-sync

### Severity Classification
- **Critical**: SWO, Vacate, Class 1 violations
- **High**: Immediately hazardous, structural, fire safety
- **Medium**: Code violations requiring correction
- **Low**: Administrative, paperwork

### Age-Based Suppression
- ECB violations older than **2 years** → auto-suppressed
- DOB/HPD violations older than **3 years** → auto-suppressed
- Suppressed violations are hidden from active counts but remain in the database

### OATH Disposition Reconciliation
- If an ECB violation appears in OATH as `Dismissed` or `Not Guilty` → auto-resolved
- Resolution events logged to `change_log`

### ⚠️ Open Questions for Review
1. Are the suppression thresholds correct (2yr ECB, 3yr DOB/HPD)?
2. Should `Stipulation Complied` in OATH always close the violation?
3. Should penalty amounts from OATH hearings be synced back to the violation record?

---

## 4. Applications Table Display

### Deduplication Strategy

NYC building applications follow a family structure:
- **I** (Initial): The primary filing (e.g., `B00518982-I1`)
- **S** (Subsequent): Follow-up filings for subsystems — plumbing, mechanical, sprinkler, etc. (e.g., `-S1`, `-S2`)
- **P** (Post-Approval Amendment): Amendments after initial approval (e.g., `-P1`, `-P2`)

### Current Display Logic
1. **I1 is the primary row** shown in the table
2. **S and P filings are nested** inside the expanded detail of their parent I1
3. If an S or P filing exists but NO I1 is in the filtered set → the S/P shows as a standalone row
4. Within the nested view, filings are sorted: I first, then S, then P

### Sort Order
- Primary sort: filing date (newest first)
- Within a job family: I → S → P (alphabetical suffix)

### Status Decoding
- BIS single-letter codes are decoded (e.g., `E` → "Permit Issued - Entire")
- DOB NOW statuses are normalized and title-cased
- Completed statuses: Signed Off, Completed, CO Issued (LOC Issued and Letter of Completion are normalized to "Signed Off")

### Active Count
- The header badge shows count of **non-completed** applications
- Terminal statuses excluded from active count

### ⚠️ Open Questions for Review
1. Is the I → S → P nesting logic correct for all agency types?
2. Should electrical filings (`-EL` suffix) be grouped differently?
3. Should the table default-sort show active applications first, then completed?

---

## 5. BIS Job Status Reference

| Code | Status | Terminal? |
|------|--------|-----------|
| A | Pre-Filed | No |
| B | Application Processing (Unpaid) | No |
| C | Application Processing (Payment Only) | No |
| D | Application Processed (Entire) | No |
| E | Application Processed - No Plan Exam | No |
| F | Assigned to Plan Examiner | No |
| G | PAA Fee Due | No |
| H | Plan Exam In Process | No |
| I | Sign-Off | ✅ Yes |
| J | Plan Exam Disapproved | ✅ Yes |
| K | Plan Exam Partial Approval | No |
| L | PAA Fee Pending | No |
| M | PAA Fee Resolved | No |
| P | Approved | No |
| Q | Permit Issued - Partial | No |
| R | Permit Issued - Entire | No |
| U | Completed | ✅ Yes |
| X | Signed-Off | ✅ Yes |
| 3 | Suspended | ✅ Yes |

### Withdrawn Detection

The BIS dataset (`ic3t-wcy2`) includes a `withdrawal_flag` column. During sync, if this flag is set (truthy), the application status is stored as **"Withdrawn"** regardless of the `job_status` letter code. Withdrawn is treated as a terminal status.

---

## 6. Reporting

The current "reporting" capability is the **Due Diligence Reports** feature (`/dashboard/dd-reports`), which:
- Aggregates active violations, applications, and building data
- Generates a formatted report with AI analysis
- Supports client-side PDF export
- Includes line-item notes and professional branding

There is **no separate analytics/reporting section** for portfolio-level metrics, violation trends over time, or compliance history dashboards. This is a potential future feature.

### Potential Reporting Features (Roadmap)
- Portfolio violation trend charts (violations opened/closed per month)
- Compliance score history over time
- Cost analysis (total penalties, estimated remediation costs)
- Scheduled automated reports (weekly PDF email)
- Custom date range filtering for all metrics

---

## 7. Roadmap Items from This Review

| Item | Priority | Status |
|------|----------|--------|
| Validate SWO active-status allowlist (D/E/F) | 🔴 High | ⏳ Awaiting review |
| Add DOB NOW SWO detection | 🟡 Medium | 📋 Planned |
| SWO auto-resolution on status change | 🟡 Medium | 📋 Planned |
| Vacate Order separate handling | 🟡 Medium | 📋 Planned |
| CO display: show source job number | 🟢 Low | 📋 Planned |
| TCO expiration alerts | 🟡 Medium | 📋 Planned |
| Portfolio-level reporting dashboard | 🟡 Medium | 📋 Planned |
| Scheduled automated PDF reports | 🟢 Low | 📋 Planned |
| OATH penalty sync to violations | 🟢 Low | 📋 Planned |

---

---

## 8. Disabled Integrations (2026-03-02)

### SMS (Twilio)
- **Edge function**: `send-sms` — returns a soft "disabled" response (HTTP 200 with `success: false`)
- **Inbound webhook**: `sms-webhook` — returns empty TwiML `<Response></Response>`
- **UI impact**: SMS checkbox in CreateWorkOrderDialog and PropertyWorkOrdersTab is commented out
- **Why disabled**: Cost evaluation + missing Twilio request signature validation (security audit finding)

### WhatsApp (Twilio)
- **Edge function**: `whatsapp-webhook` — returns empty TwiML
- **UI impact**: WhatsAppTab shows "Coming Soon" placeholder
- **Why disabled**: Same as SMS + Base64 link codes expose internal UUIDs (should be cryptographic tokens)
- **Tables**: `whatsapp_users` table still exists but is not actively used

### Re-enablement Checklist
1. ☐ Implement Twilio request signature validation on all inbound webhooks
2. ☐ Replace Base64 link codes with cryptographic tokens (WhatsApp)
3. ☐ Budget Twilio costs (phone numbers + per-message fees)
4. ☐ Remove early-return blocks in edge functions
5. ☐ Uncomment SMS UI elements in work order components
6. ☐ Restore WhatsAppTab full UI (see git history)

---

*Last updated: March 2, 2026*
