

## Enrich Tenant Section for Commercial Property Owners

### What's Missing Today
The tenant table currently tracks: company name, contact info, unit, lease dates, rent, security deposit, lease type, escalation notes, and insurance (via expandable row). That's a decent start, but CRE owners need more to manage tenants without jumping to a spreadsheet.

### New Fields to Add (Database Migration)

Add these columns to the `tenants` table:

| Column | Type | Why |
|---|---|---|
| `tenant_sqft` | numeric | Square footage occupied -- essential for rent/sqft calculations and pro-rata CAM splits |
| `rent_per_sqft` | numeric (computed in UI) | Displayed as rent_amount / tenant_sqft -- not stored, calculated on the fly |
| `annual_escalation_pct` | numeric | Annual rent escalation percentage (e.g., 3%) -- most commercial leases have this |
| `option_terms` | text | Renewal option details (e.g., "2x 5-year options at FMV") |
| `use_clause` | text | What the tenant is permitted to do in the space (retail, office, warehouse, etc.) |
| `guarantor_name` | text | Personal or corporate guarantor on the lease |
| `guarantor_phone` | text | Guarantor contact |
| `move_in_date` | date | Actual move-in date (different from lease start) |
| `parking_spaces` | integer | Number of assigned parking spots |
| `ti_allowance` | numeric | Tenant improvement allowance given |
| `percentage_rent` | numeric | For retail: percentage of sales above breakpoint |
| `percentage_rent_breakpoint` | numeric | Sales breakpoint for percentage rent |

### UI Changes

**1. Summary Cards Row (enhanced)**
- Add a 4th card: **Weighted Avg $/SF** -- total rent / total occupied sqft
- Update existing cards to show occupancy rate if property `building_area_sqft` is known

**2. Tenant Table Columns (main row)**
- Keep: Tenant, Unit, Lease Type, Rent, Lease End, Status
- Add: **Sq Ft** column and **$/SF** calculated column
- These two columns are the most commonly referenced data points for CRE owners

**3. Expanded Row (below insurance)**
- Add a "Lease Details" section showing:
  - Annual escalation %
  - Use clause
  - Option terms
  - Guarantor (name + phone)
  - Move-in date
  - Parking spaces
  - TI allowance
  - Percentage rent + breakpoint (if applicable)
- This keeps the main table clean while giving full detail on click

**4. Add/Edit Dialog (enriched)**
- Add all new fields in logical groupings:
  - Space: Sq Ft, Parking Spaces
  - Financial: Annual Escalation %, TI Allowance, Percentage Rent, Breakpoint
  - Lease Terms: Use Clause, Option Terms, Guarantor Name/Phone, Move-in Date

### Technical Details

**Files to modify:**
- Database migration: Add 10 new columns to `tenants` table (all nullable, no breaking changes)
- `src/components/properties/detail/PropertyTenantsTab.tsx`: Update Tenant interface, EMPTY_FORM, table columns, expanded row content, and the add/edit dialog
- No RLS changes needed (existing policies on `tenants` already work)

**What stays the same:**
- Insurance section in the expandable row (unchanged)
- CAM page continues to use its own `tenant_sqft` from `cam_tenant_allocations` (separate concern)
- Portfolio-wide tenants page unaffected (can be enriched separately later)

