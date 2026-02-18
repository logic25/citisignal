

# Fix Data Mapping and Remove Unavailable Fields

## Summary
Several property fields are hardcoded to false/null when Open Data actually has the data, some PLUTO fields are incorrectly mapped, and several fields shown in the UI have no consistent Open Data source and should be removed.

## What's Actually Available (verified via API)

| Dataset | Available Fields |
|---------|-----------------|
| PLUTO | `zonemap`, `overlay1`, `overlay2`, `spdist1`, `spdist2`, `spdist3`, `ltdheight`, `splitzone`, `histdist`, `landmark` |
| DOB Jobs | `professional_cert`, `loft_board`, `adult_estab`, `landmarked`, `little_e`, `cluster`, `non_profit`, `site_fill`, `special_district_1`, `special_district_2` |

## What's NOT Available (no consistent Open Data source)

These fields will be **removed from the UI** since they can't be reliably populated:
- `cross_streets` (PAD returns 403)
- `special_place_name` (BIS-only)
- `building_remarks` (BIS-only)
- `basement_code` (BIS-only)
- `local_law` (LL 158/17 text with expiration -- BIS-only)
- `sro_restricted` (not in DOB Jobs or PLUTO)
- `ta_restricted` (not in DOB Jobs or PLUTO)
- `ub_restricted` (not in DOB Jobs or PLUTO)
- `grandfathered_sign` (not in DOB Jobs or PLUTO)
- `special_status` (no direct source)
- `environmental_restrictions` (requires separate E-Designations dataset query by BBL -- could add later)

## Implementation

### Step 1: Fix PLUTO Mapping (`src/lib/nyc-building-sync.ts`)

In `fetchPLUTOData()`:
- Add `zoningMap: p.zonemap || null` (currently missing)
- Fix `commercialOverlay`: change from `p.ltdheight` to `p.overlay2` (ltdheight is "limited height district", not commercial overlay)
- Add `landmarkStatus: p.landmark || null` (PLUTO has `landmark` column with status text)
- Add `specialDistrict`: combine `p.spdist1`, `p.spdist2`, `p.spdist3`
- Add `splitZone` handling via `p.splitzone`

### Step 2: Fix DOB Jobs Mapping (`src/lib/nyc-building-sync.ts`)

In `fetchDOBJobsByBin()`:
- Add `professionalCertRestricted: parseYesNo(d.professional_cert)` (currently missing -- this is the bug)
- Add `specialDistrict: d.special_district_1 || null` as fallback

### Step 3: Fix Merge Logic (`src/lib/nyc-building-sync.ts`)

In both `syncNYCBuildingDataByIdentifiers()` and `syncNYCBuildingData()`:
- Change `professionalCertRestricted` from hardcoded `false` to `dobJobsData?.professionalCertRestricted ?? false`
- Change `landmarkStatus` from generic `'LANDMARK'` string to actual PLUTO `landmark` field value
- Remove always-null/false fields from merge: `sroRestricted`, `taRestricted`, `ubRestricted`, `grandfatheredSign`, `specialStatus`, `localLaw`, `crossStreets`, `specialPlaceName`, `buildingRemarks`, `basementCode`

### Step 4: Clean Up Interface (`src/lib/nyc-building-sync.ts`)

Remove fields from `NYCBuildingData` interface that have no data source:
- `crossStreets`, `specialPlaceName`, `buildingRemarks`, `basementCode`
- `sroRestricted`, `taRestricted`, `ubRestricted`, `grandfatheredSign`
- `localLaw`, `specialStatus`
- `environmentalRestrictions` (can add back later with E-Designations)

Update `toPropertyUpdate()` to stop writing nulls/false for these removed fields.

### Step 5: Update UI (`PropertyOverviewTab.tsx`)

**Remove from Status and Restrictions section:**
- Cross Streets row
- Special Place Name row
- Local Law row
- SRO Restricted row
- TA Restricted row
- UB Restricted row
- Grandfathered Sign row
- Special Status row
- Environmental Restrictions row

**Keep and fix:**
- Landmark Status -- show actual PLUTO value
- Historic District -- already works
- Pro Cert Restricted -- will now show correct data after Step 2
- Loft Law -- already works from DOB Jobs
- Legal Adult Use -- already works
- City Owned -- already works from DOB Jobs
- HPD Multiple Dwelling -- keep (can be manually set)

**Zoning section -- fix display:**
- Zoning Map will now populate from PLUTO `zonemap`
- Commercial Overlay will show correct data (was showing limited height district)

### Step 6: Clean Up Property Settings Tab

Remove settings fields for data that can't be sourced, keeping only fields the user would manually enter.

## Files Changed

1. `src/lib/nyc-building-sync.ts` -- Fix PLUTO mapping (zonemap, overlay2, landmark), fix DOB Jobs mapping (professional_cert), fix merge logic, remove unavailable fields
2. `src/components/properties/detail/PropertyOverviewTab.tsx` -- Remove UI rows for unavailable fields, keep only fields with real data sources

## After Deployment

Users will need to click **Sync** on their properties to re-fetch data with the corrected mappings. The Pro Cert, Zoning Map, and Commercial Overlay fields will populate correctly after re-sync.

