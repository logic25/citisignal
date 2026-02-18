

# Fix BIS Job Grouping, Deduplication, and Permit Merge

## Problem

Three issues with BIS job 210179732:

1. **Wrong status ("Permit Entire" instead of "Signed Off")**: The BIS Jobs API returns duplicate rows per document -- old rows with status `R` (Permit Entire) and newer rows with status `X` (Signed Off). The code must pick the row with the latest `dobrundate` per document to get the current status.

2. **Wrong applicant ("Marc Robbins")**: Without grouping by job number, the last document row overwrites the primary applicant. Doc 01 (the primary filing) has applicant Isaac-Daniel Astrachan; docs 03/04 have Marc Robbins.

3. **Missing documents**: The BIS Jobs API only returns 6 docs (01-06) for this job. The remaining docs (07-20 visible on the BIS portal) are not in either Open Data dataset. We will display all docs we have and note how many are available.

## Solution

### Edge Function: `supabase/functions/fetch-nyc-violations/index.ts`

**Step 1 -- Remove the scraper** (paused per request)
- Delete the `scrapeBisPortalStatus` helper function and all calls to it
- Remove the 200ms delay logic and scraper-related variables

**Step 2 -- Deduplicate BIS rows by doc number**
- When the BIS Jobs API returns multiple rows for the same `job__` + `doc__` combination, keep only the row with the **latest `dobrundate`** (this ensures we get status `X` instead of stale `R`)

**Step 3 -- Group deduplicated docs by job number**
- Group all deduplicated rows by `job__` into a Map
- For each job group:
  - Sort docs by `doc__` ascending
  - Use **Doc 01** (or lowest doc number) as the primary record for: applicant name, professional title, license number, job description, status, owner info, proposed stories/units/height
  - Build a `bis_documents` array from all docs, each containing:
    - `doc_number` (from `doc__`)
    - `applicant_name`, `applicant_professional_title`, `applicant_license_number`
    - `description` (from `job_description`)
    - `work_type` (derived from the `other_description`, `plumbing`, `mechanical`, `sprinkler` flag fields)
    - `job_status`, `job_status_descrp`
  - Create one application record per unique job (not per doc)

**Step 4 -- Merge permit data into BIS documents**
- After fetching permit issuance data (`ipu4-2q9a`), group permits by `job__` + `job_doc___`
- For each BIS document in `bis_documents`, attach matching permit records as a `permits` sub-array
- Each permit entry includes: `permit_type`, `permit_status`, `filing_status`, `permit_sequence`, `issuance_date`, `expiration_date`, `permittee_first_name`, `permittee_last_name`, `permittee_business_name`, `permittee_license_type`, `permittee_license_number`

### UI: `src/components/properties/detail/PropertyApplicationsTab.tsx`

**Step 5 -- Update Related Filings section**
- Read from `raw_data.bis_documents` as the primary source
- Fall back to `raw_data.permits` if `bis_documents` is not present (backward compatibility)
- Each document row displays:
  - Doc number badge (01, 02, etc.)
  - Work type / description
  - Doc-specific applicant name and title
  - If permits exist for that doc: permit type, status badge, most recent issuance/expiration dates, permittee name and business
- Remove scraper-related UI elements (withdrawal banner, `total_documents` reference)

### Data Structure After Fix

```text
raw_data: {
  bis_documents: [
    {
      doc_number: "01",
      applicant_name: "ISAAC-DANIEL ASTRACHAN",
      applicant_professional_title: "RA",
      applicant_license_number: "030631",
      description: "NEW BUILDING - 12 STORY RESIDENTIAL...",
      work_type: "GC & ZONING",
      job_status: "X",
      job_status_descrp: "SIGNED OFF",
      permits: [
        {
          permit_type: "FO",
          permit_status: "ISSUED",
          filing_status: "INITIAL",
          issuance_date: "04/07/2021",
          expiration_date: "04/07/2022",
          permittee_business_name: "J.E. LEVINE BUILDER INC",
          ...
        },
        { ... 6 more permit records for doc 01 ... }
      ]
    },
    {
      doc_number: "02",
      applicant_name: "VLADIMIR SIEJAS",
      work_type: "FOUNDATION",
      job_status: "X",
      job_status_descrp: "SIGNED OFF",
      permits: []   // no permits in ipu4-2q9a for doc 02
    },
    ... docs 03-06
  ],
  permits: [...]   // kept for backward compat
}
```

## Technical Details

### Why only 6 docs instead of 20?
The BIS portal shows 20 documents, but the Open Data API (`ic3t-wcy2`) only has 6 (docs 01-06). The remaining 14 docs (likely sprinkler, fire suppression, elevator, fire alarm, standpipe, etc.) are only available through the BIS portal, not the public API. This is a known limitation of the Open Data datasets. We will display whatever docs the API provides accurately.

### Deduplication logic
```text
For each BIS row:
  key = job__ + "-" + doc__
  If key already exists in Map:
    Compare dobrundate -- keep the row with the later date
  Else:
    Add to Map
```

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/fetch-nyc-violations/index.ts` | Remove scraper, deduplicate BIS rows by latest `dobrundate`, group by job number, use Doc 01 as primary, merge permit data into `bis_documents` |
| `src/components/properties/detail/PropertyApplicationsTab.tsx` | Display `bis_documents` in Related Filings with per-doc permits, remove scraper UI |

### No Database Schema Changes
All data stored in existing `raw_data` JSONB column on `applications` table.

