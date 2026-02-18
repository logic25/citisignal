

## Fix BIS Application Status Codes and Add Withdrawn Detection

### Problem

The BIS status code mapping is wrong in multiple places, causing applications to display incorrect statuses (e.g., "Permit Expired" instead of "Approved"). Additionally, withdrawn applications aren't detected because we're not reading the `withdrawal_flag` field from the BIS dataset.

### Corrected Status Code Table

Per your official BIS reference:

| Code | Current (Wrong) | Correct |
|------|-----------------|---------|
| A | Pre-Filing | Pre-Filed |
| B | Plan Examination | Application Processing (Unpaid) |
| C | Plan Exam Approval Pending | Application Processing (Payment Only) |
| D | Plan Approved | Application Processed (Entire) |
| E | Partial Permit Issued | Application Processed - No Plan Exam |
| F | Permit Issued - Entire | Assigned to Plan Examiner |
| G | Permit Renewed | PAA Fee Due |
| H | Completed | Plan Exam In Process |
| I | Signed Off | Sign-Off |
| J | Signed Off | Plan Exam Disapproved |
| K | CO Issued | Plan Exam Partial Approval |
| L | Withdrawn | PAA Fee Pending |
| M | Disapproved | PAA Fee Resolved |
| N | Suspended | (remove -- not in BIS reference) |
| P | Permit Expired | **Approved** |
| Q | Partial Permit | Permit Issued - Partial |
| R | Permit Entire | Permit Issued - Entire |
| U | (missing) | Completed |
| X | Signed Off / Completed | Signed-Off |
| 3 | (missing) | Suspended |

### Withdrawn Detection

The BIS dataset (`ic3t-wcy2`) has a **`withdrawal_flag`** column we're not currently reading. In the sync function, we'll check this field:

```text
If withdrawal_flag is truthy (e.g., "Y" or any non-empty value)
  -> store status as "Withdrawn" instead of the raw job_status code
```

This is a proper field from the dataset, not a guess from the description text.

### Terminal/Completed Statuses Update

With correct codes, the terminal statuses become:
- **I** = Sign-Off
- **X** = Signed-Off
- **U** = Completed
- **J** = Plan Exam Disapproved
- **3** = Suspended
- **Withdrawn** (from withdrawal_flag)

### Files Changed

1. **`src/components/properties/detail/PropertyApplicationsTab.tsx`** (lines 50-71)
   - Replace entire `BIS_STATUS_CODES` map with correct values (add U, 3; fix all mappings)
   - Update `COMPLETED_STATUSES` to include Withdrawn, Suspended, Plan Exam Disapproved

2. **`src/pages/dashboard/ApplicationsPage.tsx`** (lines 51-60)
   - Same corrections to the duplicated `BIS_STATUS_CODES` map and `COMPLETED_STATUSES`

3. **`supabase/functions/fetch-nyc-violations/index.ts`** (line 959)
   - Read `withdrawal_flag` from each BIS job record
   - If withdrawal_flag is set, override the stored status to "Withdrawn"
   - Change: `status: j.withdrawal_flag ? 'Withdrawn' : (j.job_status as string) || ...`

4. **`docs/DATA-LOGIC.md`** (Section 5)
   - Update the BIS Job Status Reference table with correct codes
   - Document the withdrawal_flag field usage

### Data Fix

After deploying, a re-sync of properties will correct the stored status codes. The raw `job_status` letter is stored in the database, and the UI decodes it — so fixing the UI map immediately fixes display for all existing data. The withdrawal_flag change only affects future syncs (or re-syncs).
