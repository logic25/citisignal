

## Fix Local Law Compliance "Learn More" URLs

### Problem
Several `learn_more_url` values in `src/lib/local-law-engine.ts` are broken (return 404) or are guessed URLs that likely don't exist on NYC.gov. The long-term goal is to point these to your own site's blog/knowledge base, but for now we'll fix them to point to the best available official sources.

### Confirmed Broken Links (404)

| Law | Current (Broken) URL | Corrected URL |
|-----|---------------------|---------------|
| LL97 | `nyc.gov/.../codes/ll97.page` | `nyc.gov/.../codes/ll97-greenhouse-gas-emissions-reductions.page` |
| DEP Grease | `nyc.gov/.../dep/water/grease.page` | `nyc.gov/.../dep/water/disposing-of-grease-as-a-business.page` |
| LL126/08 PIPS | `nyc.gov/.../parking-structures.page` | `nyc.gov/.../parking-structure.page` (singular) |

### Likely Invalid Links (guessed FDNY/DOB paths with no confirmation)

These follow a pattern `fdny/business/all-businesses/...` that doesn't match FDNY's actual site structure. They'll be replaced with the closest verified alternatives:

| Law | Current (Guessed) URL | Replacement |
|-----|----------------------|-------------|
| FDNY Fire Alarm | `.../fire-alarm-systems.page` | `nyc.gov/site/fdny/business/inspections/request-inspection.page` |
| FDNY Standpipe | `.../standpipe-requirements.page` | `nyc.gov/site/buildings/industry/sprinklers-standpipes-requirements.page` |
| FDNY Sprinkler | `.../sprinkler-requirements.page` | `nyc.gov/site/buildings/industry/sprinklers-standpipes-requirements.page` |
| FDNY PA | `.../places-of-assembly.page` | `nyc.gov/assets/buildings/pdf/code_notes_place-of-assembly.pdf` |
| FDNY Extinguisher | `.../portable-fire-extinguishers.page` | `nyc.gov/site/fdny/business/all-certifications/portable-fire-extinguishers-company-certificates.page` |
| FDNY/DOB Emergency Lighting | `.../exit-signs-and-emergency-lighting.page` | `nyc.gov/site/fdny/business/inspections/request-inspection.page` |
| LL10/99 Fire Door | `.../fire-safety-education-notice.page` | `nyc.gov/site/fdny/business/inspections/request-inspection.page` |
| LL26 Sprinkler Retrofit | `.../sprinkler-requirements.page` | `nyc.gov/site/buildings/industry/sprinklers-standpipes-requirements.page` |

### File Changed

`src/lib/local-law-engine.ts` -- update ~11 `learn_more_url` string values across various check functions.

### Technical Details

Each fix is a single string replacement on the `learn_more_url` property within the respective `check*()` function. No logic changes. Functions affected:

1. `checkLL97` (line 249)
2. `checkLL126PIPS` (line 185)
3. `checkGreaseTrap` (line 658)
4. `checkLL26` (line 536)
5. `checkFireAlarm` (line 816)
6. `checkStandpipe` (line 835)
7. `checkSprinklerMaintenance` (line 854)
8. `checkPlaceOfAssembly` (line 872)
9. `checkFireExtinguisher` (line 891)
10. `checkEmergencyLighting` (line 910)
11. `checkFireSafetyDoor` (line 575)

### Future

Long-term, all these URLs should be replaced with links to your own site's blog/knowledge base pages that explain each local law and link out to the official source.

