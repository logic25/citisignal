
# NYC Building Data Sync — Comprehensive Plan

## Summary
Expand the property sync engine to achieve ZoLa-level data parity from PLUTO, add new data sources (E-Designations, LPC Landmarks), fix Professional Cert sourcing from DOB Jobs, and remove fields with no reliable Open Data source.

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

### Step 1: Add Missing PLUTO Fields (`src/lib/nyc-building-sync.ts`)

In `fetchPLUTOData()`, add these new fields:
- `zonedist2: p.zonedist2 || null`
- `zonedist3: p.zonedist3 || null`
- `lotFrontage: parseNumber(p.lotfront)`
- `lotDepth: parseNumber(p.lotdepth)`
- `schoolDistrict: p.schooldist || null`
- `policePrecinct: p.policeprct || null`
- `fireCompany: p.firecomp || null`
- `sanitationBorough: p.sanitboro || null`
- `sanitationSubsection: p.sanitsub || null`
- `landUse: p.landuse || null`
- `totalUnits: parseInt_(p.unitstotal)`
- `splitZone: p.splitzone === 'Y'`
- `limitedHeightDistrict: p.ltdheight || null`

Fix existing mappings:
- `zoningMap: p.zonemap || null` (currently missing)
- `commercialOverlay: p.overlay2 || null` (was incorrectly mapped to ltdheight)
- `landmarkStatus: p.landmark || null` (use actual PLUTO value)

### Step 2: Fix Professional Cert from DOB Jobs

In `fetchDOBJobsByBin()`:
- Change `$limit` from 1 to 10 (check multiple filings)
- Iterate through all results: set `professionalCertRestricted = true` if ANY filing has `professional_cert = 'Y'`
- This fixes the bug where the most recent filing may not have the field set

### Step 3: Add E-Designations Fetch (`jsrs-ggnx`)

New function `fetchEDesignations(bbl: string)`:
- Query: `https://data.cityofnewyork.us/resource/jsrs-ggnx.json?$where=bbl='${bbl}'`
- Map to `environmentalRestrictions` field (concatenated descriptions)
- Called during `syncNYCBuildingDataByIdentifiers()` in parallel with PLUTO/DOB

### Step 4: Add LPC Landmark Details (`gpmc-yuvp`)

New function `fetchLPCLandmarkDetails(bbl: string)`:
- Query: `https://data.cityofnewyork.us/resource/gpmc-yuvp.json?$where=bbl='${bbl}'`
- Map: `lpc_number`, `lm_name`, `lm_type`, `status`
- Enriches `landmarkStatus` with actual LPC designation details
- Called in parallel during sync

### Step 5: Database Migration

Add new columns to `properties` table:
- `zoning_district_2 TEXT`
- `zoning_district_3 TEXT`
- `lot_frontage NUMERIC`
- `lot_depth NUMERIC`
- `school_district TEXT`
- `police_precinct TEXT`
- `fire_company TEXT`
- `sanitation_borough TEXT`
- `sanitation_subsection TEXT`
- `land_use TEXT`
- `total_units INTEGER`
- `split_zone BOOLEAN DEFAULT false`
- `limited_height_district TEXT`

### Step 6: Update `NYCBuildingData` Interface & `toPropertyUpdate()`

- Add new fields to interface
- Map new fields in `toPropertyUpdate()` for database storage
- Remove unavailable fields from interface

### Step 7: Update UI — Property Overview Tab

**Add to Zoning section:**
- Zoning District 2, 3 (if present)
- Limited Height District
- Split Zone indicator

**Add new "Neighborhood Information" section** (matching ZoLa):
- Community District (already have)
- Council District (already have)
- School District
- Police Precinct
- Fire Company
- Sanitation Borough / Subsection

**Add to Building Info:**
- Lot Frontage, Lot Depth
- Total Units (distinct from Residential Units)
- Land Use category

**Fix existing:**
- Zoning Map — will populate from PLUTO `zonemap`
- Commercial Overlay — corrected mapping from `overlay2`
- Landmark Status — actual PLUTO value
- Pro Cert Restricted — fixed DOB Jobs multi-filing check
- Environmental Restrictions — now sourced from E-Designations

**Remove from Status & Restrictions:**
- Cross Streets, Special Place Name, Local Law
- SRO/TA/UB Restricted, Grandfathered Sign, Special Status

### Step 8: Update Property Settings Tab

Remove settings fields for data with no source. Keep only user-editable feature flags.

## Files Changed

1. `src/lib/nyc-building-sync.ts` — Add PLUTO fields, fix DOB Jobs professional_cert, add E-Designations + LPC fetchers, update merge logic
2. `src/components/properties/detail/PropertyOverviewTab.tsx` — Add Neighborhood Info section, lot dimensions, fix zoning display, remove unavailable fields
3. `src/components/properties/PropertySettingsTab.tsx` — Remove unavailable field toggles
4. Database migration — Add new columns for neighborhood/lot data

## After Deployment

Users must click **Sync** on properties to fetch data with new mappings. All new PLUTO fields, E-Designations, and LPC data will populate after re-sync.
