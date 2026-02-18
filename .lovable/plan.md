

# Expand Local Law Engine to 43 NYC Compliance Obligations

## Overview
The current engine tracks 11 laws. This plan expands it to cover all 43 violation-generating compliance obligations you've documented, fixes the LL126 misidentification, and adds the necessary database columns and UI toggles.

## Phase 1: Database Migration

Add new boolean feature columns to the `properties` table to drive applicability logic for laws that depend on building characteristics we don't currently track:

| Column | Default | Drives |
|--------|---------|--------|
| `has_retaining_wall` | false | LL37 |
| `has_parking_structure` | false | LL126/08 (PIPS) |
| `has_cooling_tower` | false | LL77/15 Cooling Tower |
| `has_water_tank` | false | LL76 Water Tank |
| `has_fire_alarm` | false | FDNY Fire Alarm |
| `has_standpipe` | false | FDNY Standpipe |
| `has_place_of_assembly` | false | FDNY PA Certificate |
| `is_food_establishment` | false | DEP Grease Trap |
| `has_backflow_device` | false | DEP Backflow Prevention |
| `burns_no4_oil` | false | LL32 Oil Phaseout |

That's 10 new boolean columns on `properties`.

## Phase 2: Fix Existing Laws

1. **LL126 -> Parapet Inspection**: Rename the current `checkLL126` to `checkLL126Parapet`. Change applicability to `applies = true` for all buildings (parapets are nearly universal). Annual cycle, due Dec 31, penalty up to $10,000.

2. **Add LL157**: New function `checkLL157` for Natural Gas Detectors using the gas-service logic that LL126 currently has. Residential buildings with gas, deadline May 1, 2025.

3. **Fix LL88**: Currently only applies to non-residential. Per your doc, it applies to all buildings >= 25,000 SF (commercial spaces AND common areas of residential). Update the applicability check.

4. **Fix LL11**: Update description to reference 5-year cycle within Cycle 10 (not 9-year). Update penalty to "$1,000/month for late filing."

5. **Fix PropertySettingsTab labels**: The elevator toggle currently says "LL126 elevator inspections" -- should say "LL62 elevator inspections." The boiler toggle says "LL62 boiler inspections" -- should say "Boiler Inspection (Admin Code)."

## Phase 3: Add New Law Check Functions (32 new functions)

Organized by category from your document:

### Category 1: Facade, Exterior & Structural (2 new)
- **LL126/08 -- Parking Structure (PIPS)**: `has_parking_structure` flag, 6-year cycle
- **LL37 -- Retaining Wall**: `has_retaining_wall` flag, 5-year cycle

### Category 2: Energy & Emissions (6 new)
- **LL33/95 -- Energy Grade Posting**: >= 25,000 SF, annual (Oct 31)
- **LL32 -- No. 4 Oil Phaseout**: `burns_no4_oil` flag, deadline July 2027
- **LL92/94 -- Green Roof/Solar**: New construction/major roof only (event-triggered, default exempt)
- **LL85 -- Energy Code Compliance**: At renovation (event-triggered, default exempt)
- **LL154 -- All-Electric Law**: New construction (event-triggered, default exempt)
- (LL84, LL97, LL87, LL88 already exist -- just fixes)

### Category 3: Gas Safety (2 new)
- **LL157 -- Gas Detectors**: Residential with gas, deadline May 2025
- **LL159 -- Gas Leak Notice**: All buildings with gas, ongoing
- (LL152, LL33/95 post-incident already exist)

### Category 4: Elevators & Mechanical (1 new)
- **Boiler Inspection**: `has_boiler` flag, annual (Dec 31)
- (LL62 already exists)

### Category 5: Fire Safety & Sprinklers (2 new)
- **LL77/17 -- Crane Wind Plan**: Already exists, keep as-is
- **Fire Safety Door Notice (LL10/99)**: All residential, annual

### Category 6: DOHMH (2 new)
- **LL77/15 -- Cooling Tower**: `has_cooling_tower` flag, annual cert Nov 1
- **LL76 -- Water Tank**: `has_water_tank` flag, annual Jan 15

### Category 7: DEP (2 new)
- **Backflow Prevention**: `has_backflow_device` flag, annual
- **Grease Trap**: `is_food_establishment` flag, ongoing

### Category 8: HPD Residential (7 new)
- **LL1 -- Lead Paint**: Pre-1960 residential, annual inquiry
- **LL55 -- Indoor Allergens**: 3+ units, annual
- **Bedbug Reporting**: Multiple dwellings, annual (Dec)
- **Window Guard Notice**: 3+ apartments, annual (Jan)
- **HPD Registration**: Multiple dwellings, annual
- **Heat/Hot Water**: All residential, ongoing (Oct-May)
- **Smoke/CO Detectors**: All residential, ongoing

### Category 9: FDNY (6 new)
- **Fire Alarm Inspection**: `has_fire_alarm` flag, annual
- **Standpipe Inspection**: `has_standpipe` flag, annual + 5-year
- **Sprinkler Maintenance**: `has_sprinkler` flag, annual (separate from LL26 retrofit)
- **Place of Assembly (PA)**: `has_place_of_assembly` flag, ongoing
- **Fire Extinguisher**: Commercial buildings, annual
- **Emergency/Exit Lighting**: All buildings, ongoing

### Category 10: Multi-Agency (4 new)
- **LL196 -- SST Training**: Construction sites (event-triggered, default exempt)
- **Grease Trap**: (covered under DEP above)
- **Asbestos (ACP5/ACP7)**: Per project (event-triggered, default exempt)
- **Construction Noise**: Per project (event-triggered, default exempt)
- **CO Compliance**: All buildings, ongoing

## Phase 4: Update PropertyForCompliance Interface

Add all new boolean fields to the TypeScript interface so the engine can read them from property data.

## Phase 5: Update Property Settings Tab

Expand the Building Features card to show all new toggleable features, organized into logical groups:

- **Mechanical Systems**: Gas, Boiler, Elevator, Sprinkler, Standpipe, Fire Alarm
- **Structural Features**: Retaining Wall, Parking Structure, Cooling Tower, Water Tank
- **Use & Operations**: Place of Assembly, Food Establishment, Backflow Device, Burns No. 4 Oil

## Phase 6: Update getApplicableLaws

Wire all ~43 check functions into the main `getApplicableLaws` array. Add a `category` field to `LocalLawRequirement` interface so the compliance grid can group laws by category (DOB Facade, DOB Energy, Gas Safety, HPD, FDNY, etc.).

## Phase 7: Update Compliance Grid UI

Modify `LocalLawComplianceGrid.tsx` to group laws by category with collapsible sections, making the 43-law list navigable rather than one long scroll.

## Technical Notes

- Event-triggered laws (LL92/94, LL85, LL154, LL196, Asbestos, Construction Noise) will default to `exempt` status with a note explaining they apply only during specific project activities. Users can't toggle these -- they're informational.
- The `LocalLawRequirement` interface gets a new optional `category` field (string) for grouping in the UI.
- All penalty amounts and learn_more_urls come directly from your reference document.
- The compliance scoring engine (`calculate_compliance_score` DB function) already reads from `compliance_requirements` table, so no changes needed there -- the local law engine feeds the UI display, not the scoring directly.

## Files to Create/Modify

| File | Action |
|------|--------|
| Database migration | Add 10 boolean columns to `properties` |
| `src/lib/local-law-engine.ts` | Rewrite: fix LL126, add 32 new check functions, add category field |
| `src/components/properties/PropertySettingsTab.tsx` | Add new feature toggles in organized groups |
| `src/components/properties/detail/LocalLawComplianceGrid.tsx` | Add category grouping for 43 laws |
| `src/integrations/supabase/types.ts` | Auto-updated after migration |

