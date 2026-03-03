

## Fix Agency Coverage: Backfill + Settings Tab Editor

### Problem
- Existing properties only have 2-4 agencies (created before the 10-agency expansion)
- The Edit Property dialog has no way to change tracked agencies
- Agency badges on the property detail page only show what was originally saved

### Approach
All 10 agencies included by default for every NYC property. Agency toggling available in the property Settings tab for users who want to customize.

### Changes

**1. Database Migration -- Backfill Existing Properties**
- Run an UPDATE on `properties` to set `applicable_agencies` to all 10 agencies for any NYC property that currently has fewer than 10

```text
UPDATE properties
SET applicable_agencies = ARRAY['DOB','ECB','HPD','FDNY','DOT','DSNY','DEP','LPC','DOF','DOHMH']
WHERE jurisdiction = 'NYC'
  AND (applicable_agencies IS NULL OR array_length(applicable_agencies, 1) < 10);
```

**2. Add Agency Editor to PropertySettingsTab**
- File: `src/components/properties/PropertySettingsTab.tsx`
- Add an "Agencies Tracked" section with a checkbox grid (same style as AddPropertyDialog)
- Include Select All / Deselect All toggle
- Save changes to `applicable_agencies` column on the `properties` table
- This keeps the Edit Property dialog focused on building data (address, BIN, dimensions, etc.)

**3. Update Fallback Defaults**
- In `PropertyDetailPage.tsx` line 217 and `ViolationsPage.tsx` line 144, update the fallback arrays to include all 10 agencies so even un-migrated properties show correctly in the UI

### What stays the same
- Edit Property dialog remains focused on building attributes (no agency selector there)
- Add Property dialog keeps its current agency grid with Select All
- Pricing tiers stay based on property count, not agency count

