

# Security Vulnerability Fixes Plan

This plan covers 28 security fixes across edge functions, frontend code, RLS policies, and build configuration. The fixes are grouped into logical batches for implementation.

---

## Batch 1: Edge Function Authorization Checks (Fixes 1-6)

### Fix 1 -- extract-document-text ownership check
Add a query after line 120 to verify the user owns the document's property before allowing extraction. Uses `supabaseAdmin` to check `property_documents` joined with `properties.user_id`.

### Fix 2 -- generate-po ownership check
After the work order fetch (line 154), verify `wo.property?.user_id === user.id` before proceeding. The select already includes `user_id` in the property join.

### Fix 3 -- work-order-followup scoping
After auth check (line 44), fetch the user's property IDs and add `.in("property_id", userPropertyIds)` to all three work order queries (staleDispatched, staleApproved, staleInProgress).

### Fix 4 -- send-email-digest caller restriction
This function uses service role key and accepts `user_id` in the body. Add auth header validation: extract the calling user from the JWT and ensure `body.user_id` matches the authenticated user (or the caller is an admin).

### Fix 5 -- lease-qa property/document ownership
After parsing the request body, verify `propertyId` ownership via `properties.user_id` and `documentId` ownership via `property_documents` joined with `properties`.

### Fix 6 -- property-ai property ownership
Same pattern as Fix 5: verify `propertyId` belongs to the authenticated user.

---

## Batch 2: Client-Side Query Scoping (Fixes 9-11, 21)

### Fix 9 -- PropertiesPage user_id filter
Add `.eq('user_id', user.id)` to the properties query at line 75. The `user` object is already available in scope.

### Fix 10 -- ViolationsPage user_id filter
Add user scoping to both the violations and properties queries at line 97. Use `!inner` join on properties to filter violations by `user_id`.

### Fix 11 -- LeaseQAChat auth token
Replace the manual `fetch()` at line 204 with `supabase.functions.invoke('lease-qa', {...})` which automatically sends the user's session token. Adjust response handling for the non-streaming invoke response (note: `functions.invoke` does not support streaming, so we need to keep `fetch()` but use the actual session token instead of the anon key).

**Revised Fix 11**: Keep `fetch()` for streaming support but replace the hardcoded anon key with the user's actual session token from `supabase.auth.getSession()`.

### Fix 21 -- DashboardOverview user scoping
Add `.eq('user_id', user.id)` to the properties query and use the resulting IDs to scope violations. The `user` is already in scope.

---

## Batch 3: Input Sanitization (Fixes 7-8)

### Fix 7 -- SmartAddressAutocomplete SoQL sanitization
Add a `sanitizeSoQL()` function that strips non-alphanumeric characters (keeping spaces, hyphens, periods). Apply it to all interpolated variables in the PLUTO query (line 197) and DOB Jobs query (line 288).

### Fix 8 -- generate-dd-report SoQL sanitization
Add the same `sanitizeSoQL()` function to the edge function and apply it to all address components interpolated into NYC API `$where` clauses.

---

## Batch 4: RLS Policy Fixes (Fixes 12-18) -- Database Migrations

Seven migrations to tighten overly permissive RLS policies:

- **Fix 12**: `notifications` INSERT -- restrict to `auth.uid() = user_id`
- **Fix 13**: `oath_hearings` INSERT/UPDATE -- restrict to violations on user's properties
- **Fix 14**: `compliance_scores` SELECT/INSERT/UPDATE -- restrict to user's properties
- **Fix 15**: `email_log` INSERT -- restrict to `auth.uid() = user_id`
- **Fix 16**: `change_log` INSERT -- restrict to `auth.uid() = user_id`; remove UPDATE policy (immutable audit records)
- **Fix 17**: `work_order_messages` SELECT/INSERT -- restrict to work orders on user's properties
- **Fix 18**: `property-documents` storage INSERT -- restrict uploads to user's own property folders

---

## Batch 5: Race Condition and Hardcoded Values (Fixes 19-20, 22-23)

### Fix 19 -- validate-invite-code atomic increment
Move the `use_count` increment BEFORE `createUser`. Use `.lt('use_count', code.max_uses)` in the update to make it atomic.

### Fix 20 -- Hardcoded URLs in send-email-digest
The `RESEND_FROM_ADDRESS` and `APP_URL` are already using `Deno.env.get()` (confirmed at lines 449 and 479). No changes needed. Will scan other functions for any remaining hardcoded URLs.

### Fix 22 -- Environment variable validation
Replace `?? ""` fallback patterns with explicit null checks that return 500 errors in all edge functions.

### Fix 23 -- localStorage input validation
Validate the stored view mode against allowed values before using it.

---

## Batch 6: Infrastructure Hardening (Fixes 24-28)

### Fix 24 -- .gitignore
Add `.env`, `.env.local`, `.env.*.local` entries. (Note: Lovable manages `.env` automatically, but this is good practice.)

### Fix 25 -- react-router-dom update
**Skipped**: Upgrading from v6 to v7 is a major version bump with breaking API changes that would require significant refactoring. Will note this as a future task.

### Fix 26 -- html2pdf.js (not jsPDF)
The project uses `html2pdf.js`, not `jspdf` directly. Will check if there's a newer version available.

### Fix 27 -- Dynamic CORS origins
Replace `"Access-Control-Allow-Origin": "*"` with a `getCorsHeaders(req)` function in all edge functions that checks the `Origin` header against an `ALLOWED_ORIGINS` env var. This affects ~15+ edge functions.

### Fix 28 -- Disable source maps
Add `build: { sourcemap: false }` to `vite.config.ts`.

---

## Implementation Order

1. Batch 4 (RLS migrations) -- database changes first
2. Batch 1 (Edge function auth) -- server-side security
3. Batch 3 (Input sanitization) -- injection prevention
4. Batch 5 (Race conditions, env validation)
5. Batch 2 (Client-side scoping)
6. Batch 6 (Infrastructure)

---

## Technical Notes

- **Fix 11 revised**: Cannot use `supabase.functions.invoke()` because the lease-qa function returns a streaming response (`text/event-stream`). Instead, will get the user's session token via `supabase.auth.getSession()` and pass it in the Authorization header.
- **Fix 20**: Already addressed in the current code -- `APP_URL` and `RESEND_FROM_ADDRESS` are read from env vars.
- **Fix 25**: react-router-dom v6 to v7 migration is a breaking change -- recommend deferring to a separate task.
- **Fix 27**: Requires adding an `ALLOWED_ORIGINS` secret after deployment.
- All edge function changes preserve existing CORS preflight handling.
- RLS migrations use `DROP POLICY IF EXISTS` for safety.

