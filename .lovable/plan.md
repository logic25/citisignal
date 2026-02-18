

# BIS Permit Sub-Filings + Lightweight BIS Portal Scraper

Two features in one rollback-safe deployment: (1) pull "Related Filings" (Doc 01, 02, 03...) from the DOB Permit Issuance dataset, and (2) add a targeted BIS portal scraper for withdrawal detection and other portal-only fields.

---

## Part 1: BIS Related Filings from Permit Issuance Dataset (`ipu4-2q9a`)

### Edge Function Changes

**File:** `supabase/functions/fetch-nyc-violations/index.ts`

1. Add new endpoint constant:
```text
DOB_PERMIT_ISSUANCE: "https://data.cityofnewyork.us/resource/ipu4-2q9a.json"
```

2. After the BIS jobs fetch (around line 930), add a parallel fetch for permit issuance data:
```text
?bin__=${bin}&$limit=500&$order=issuance_date DESC
```

3. Group the returned permit records into a Map keyed by `job__` (parent job number).

4. When building each BIS `applicationRecords` entry, look up the job number in the permit map and attach matching records to `raw_data.permits` as an array. Each permit record captures:
   - `job_doc` (from `job_doc___`) -- the document number (01, 02, 03...)
   - `permit_type`, `permit_status`, `filing_status` (INITIAL vs SUBSEQUENT)
   - `permit_sequence`, `issuance_date`, `expiration_date`, `job_start_date`
   - `permittee_first_name`, `permittee_last_name`, `permittee_business_name`
   - `permittee_license_type`, `permittee_license_number`
   - `permittee_phone`
   - `owner_first_name`, `owner_last_name`, `owner_business_name`

### UI Changes

**File:** `src/components/properties/detail/PropertyApplicationsTab.tsx`

In `renderBisDetails()` (line 535), after the existing content (before the closing `</div>` at line 593), add a "Related Filings" section that checks for `app.raw_data?.permits`:

- If permits exist, render a section titled "Related Filings (Doc 01, 02...)" with each permit as a compact row showing:
  - Document number badge (01, 02, 03)
  - Filing type (Initial / Subsequent)
  - Permit type and status with color-coded badge
  - Issuance and expiration dates
  - Permittee name, business, and license info
- Sorted by `job_doc` ascending (initial first, then subsequent filings)
- Styled consistently with the existing DOB NOW related filings section

---

## Part 2: Lightweight BIS Portal Scraper for Withdrawal Detection

### New Edge Function

**File:** `supabase/functions/fetch-nyc-violations/index.ts` (inline, not a separate function)

Add a helper function `scrapeBisPortalStatus(jobNumber: string)` that:

1. Fetches the BIS portal page at:
```text
https://a810-bisweb.nyc.gov/bisweb/JobsQueryByNumberServlet?passjobnumber={jobNumber}
```

2. Parses the HTML response (plain text parsing, no DOM library needed) looking for:
   - **"JOB WITHDRAWN"** text -- if found, returns `{ withdrawn: true, withdrawal_date: extracted_date }`
   - Any other portal-only status indicators we identify later

3. Has a short timeout (5 seconds) and gracefully returns `null` on failure -- this is enrichment, not blocking.

### Integration with Sync Flow

After building each BIS application record:
- If the API `withdrawal_flag` is `'0'` or empty (i.e., not withdrawn per the API), call the scraper as an optional enrichment step
- If the scraper detects "JOB WITHDRAWN", override the status to `'Withdrawn'` and store the withdrawal date in `raw_data.withdrawal_date`
- Rate-limit: add a 200ms delay between scraper calls to avoid hammering the BIS server
- Only scrape jobs with active statuses (skip already-completed jobs like Sign-Off, Completed) to minimize requests

### Scraper Implementation Details

The BIS portal HTML is simple server-rendered HTML. The withdrawal text appears as:
```text
JOB WITHDRAWN: MM/DD/YYYY
```

The parser will:
1. Search for the regex pattern `JOB WITHDRAWN[:\s]*(\d{2}/\d{2}/\d{4})?`
2. Extract the date if present
3. Return a simple result object

### Safeguards
- 5-second timeout per request
- Only runs during full sync (not quick DOB sync)
- Skips terminal-status jobs
- Graceful failure -- if scraping fails, the API data stands as-is
- Can be toggled off by removing the scraper call without any other changes

---

## Files Changed Summary

| File | Change |
|------|--------|
| `supabase/functions/fetch-nyc-violations/index.ts` | Add `DOB_PERMIT_ISSUANCE` endpoint, fetch + group permits by job, attach to `raw_data.permits`, add `scrapeBisPortalStatus()` helper for withdrawal detection |
| `src/components/properties/detail/PropertyApplicationsTab.tsx` | Add "Related Filings" section in `renderBisDetails()` showing permit documents (01, 02...) with permittee info |

## No Database Schema Changes

All data stored in the existing `raw_data` JSONB column on the `applications` table.

## Rollback

Both changes are fully reversible via Lovable version history. The permit data in `raw_data` is additive and does not affect existing fields. The scraper is an optional enrichment that falls back gracefully.

