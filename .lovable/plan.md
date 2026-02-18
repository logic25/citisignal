
# NYC Building Data Sync — Comprehensive Plan

## Summary
Expand the property sync engine to achieve ZoLa-level data parity from PLUTO, add new data sources (E-Designations, LPC Landmarks), fix Professional Cert sourcing from DOB Jobs, and remove fields with no reliable Open Data source.

## Status: Steps 1–7 COMPLETE ✅

## What's Actually Available (verified via API)

| Dataset | API ID | Available Fields |
|---------|--------|-----------------|
| PLUTO | 64uk-42ks | `zonedist1`, `zonedist2`, `zonedist3`, `zonemap`, `overlay1`, `overlay2`, `spdist1-3`, `ltdheight`, `splitzone`, `histdist`, `landmark`, `lotfront`, `lotdepth`, `schooldist`, `policeprct`, `firecomp`, `sanitboro`, `sanitsub`, `landuse`, `unitstotal`, `numbldgs`, `numfloors`, `bldgarea`, `unitsres`, `lotarea`, `bldgclass`, `yearbuilt`, `assessland`, `assesstot`, `exempttot`, `builtfar`, `residfar`, `commfar` |
| DOB Jobs | ic3t-wcy2 | `professional_cert`, `loft_board`, `adult_estab`, `landmarked`, `little_e`, `cluster`, `non_profit`, `site_fill`, `special_district_1`, `special_district_2` |
| E-Designations | jsrs-ggnx | Environmental restriction records by BBL — `e_designation_number`, `description`, `zoning_map_changes` |
| LPC Landmarks | gpmc-yuvp | Individual and historic district landmarks — `lpc_number`, `lm_name`, `lm_type`, `status`, `cal_date`, `most_recent` |

## What's NOT Available (no consistent Open Data source)

These fields are **removed from the UI** since they can't be reliably populated:
- `cross_streets` (PAD returns 403)
- `special_place_name` (BIS-only)
- `building_remarks` (BIS-only)
- `basement_code` (BIS-only)
- `local_law` (LL 158/17 text with expiration — BIS-only)
- `sro_restricted`, `ta_restricted`, `ub_restricted`, `grandfathered_sign` (not in DOB Jobs or PLUTO)
- `special_status` (no direct source)

## Implementation

### Step 1: Add Missing PLUTO Fields ✅

In `fetchPLUTOData()`, added:
- `zonedist2`, `zonedist3`, `lotFrontage`, `lotDepth`, `schoolDistrict`, `policePrecinct`, `fireCompany`, `sanitationBorough`, `sanitationSubsection`, `landUse`, `totalUnits`, `splitZone`, `limitedHeightDistrict`
- Fixed `zoningMap`, `commercialOverlay`, `landmarkStatus` mappings

### Step 2: Fix Professional Cert from DOB Jobs ✅

- Changed `$limit` from 1 to 10 (scans multiple filings)
- `professionalCertRestricted = true` if ANY filing has `professional_cert = 'Y'`

### Step 3: Add E-Designations Fetch (`jsrs-ggnx`) ✅

- `fetchEDesignations(bbl)` queries environmental restriction records
- Concatenates descriptions into `environmentalRestrictions` field
- Called in parallel during `syncNYCBuildingDataByIdentifiers()`

### Step 4: Add LPC Landmark Details (`gpmc-yuvp`) ✅

- `fetchLPCLandmarkDetails(bbl)` queries individual/historic district landmarks
- Enriches `landmarkStatus` with LPC designation details (number, name, type, status)
- Called in parallel during sync

### Step 5: Database Migration ✅

Added columns to `properties` table:
- `zoning_district_2`, `zoning_district_3`, `lot_frontage`, `lot_depth`, `school_district`, `police_precinct`, `fire_company`, `sanitation_borough`, `sanitation_subsection`, `land_use`, `total_units`, `split_zone`, `limited_height_district`

### Step 6: Update `NYCBuildingData` Interface & `toPropertyUpdate()` ✅

- New fields added to interface and mapped in `toPropertyUpdate()`
- Unavailable fields removed from interface

### Step 7: Update UI — Property Overview Tab ✅

- Added Neighborhood Information section (School District, Police Precinct, Fire Company, Sanitation)
- Added Lot Frontage/Depth and Land Use to Building Details
- Added Split Zone and Limited Height District to Zoning section
- Removed unavailable fields from Status & Restrictions

### Step 8: Update Property Settings Tab — TODO

Remove settings fields for data with no source. Keep only user-editable feature flags.

### Step 9: Integrate Building Sync into Sync Button ✅

- `PropertyDetailPage.tsx` "Sync Data" button now runs both client-side building data sync (PLUTO/DOB/E-Designations/LPC) and server-side violation sync in parallel
- Building data is persisted to the database immediately after fetch

## Files Changed

1. `src/lib/nyc-building-sync.ts` — Added PLUTO fields, fixed DOB Jobs professional_cert, added E-Designations + LPC fetchers, updated merge logic
2. `src/components/properties/detail/PropertyOverviewTab.tsx` — Added Neighborhood Info section, lot dimensions, fixed zoning display, removed unavailable fields
3. `src/pages/dashboard/PropertyDetailPage.tsx` — Integrated building sync into Sync Data button
4. Database migration — Added new columns for neighborhood/lot data

## After Deployment

Users must click **Sync** on properties to fetch data with new mappings. All new PLUTO fields, E-Designations, and LPC data will populate after re-sync.
