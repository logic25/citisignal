
# Three Features: AI Stress-Test, AI Idea Intake & AI Usage Dashboard
## (Clarity: Placeholder UI Only — Script Added Later)

---

## On Microsoft Clarity

You do NOT need to add Clarity right now — you can add the script tag any time, it's just one paste into `index.html`. The plan below skips the live script entirely and instead adds a **"Session Analytics" placeholder tab** in the Admin section so you can see exactly what data Clarity will surface (heatmaps, session recordings, rage clicks, scroll depth) and where the setup instructions will live when you're ready to activate it. Nothing breaks if the script isn't there yet.

---

## Feature 1 — Microsoft Clarity Placeholder (No Script Yet)

**New component**: `src/components/helpdesk/ClarityPlaceholder.tsx`

A preview card shown in a new **"Session Analytics"** tab in the Help Center (admin-only). It will show:

- A banner: "Microsoft Clarity is not yet connected" with a setup button
- A grid of what you'll see once connected, with tooltips explaining each metric:
  - **Session Recordings** — Watch real users click, scroll, and navigate. Understand where they get confused.
  - **Heatmaps** — See which parts of the page users click on most (and which they ignore).
  - **Rage Clicks** — Spots where users click frantically, usually indicating something broken or confusing.
  - **Scroll Depth** — How far down a page users scroll before leaving.
  - **Dead Clicks** — Clicks on elements users expect to be clickable but aren't.
  - **Insights Dashboard** — AI-generated highlights from Clarity about friction in your app.
- A code snippet block (non-functional, just shows the script) so you know exactly what to paste when ready, with the note: "Replace `YOUR_CLARITY_TAG_ID` with your CitiSignal project ID from clarity.microsoft.com"
- A direct link button: "Create Clarity Project →" pointing to clarity.microsoft.com

This tab is visible only when `isAdmin === true`.

---

## Feature 2 — AI Stress-Test (Roadmap Items)

### New Edge Function: `supabase/functions/analyze-telemetry/index.ts`

Handles two modes in one function:

**Mode: `"idea"`**
- Input: `{ mode: "idea", raw_idea: string, existing_items?: string[] }`
- Calls `google/gemini-3-flash-preview` via Lovable AI Gateway
- System prompt: senior product analyst — stress-tests the idea, surfaces risks, flags duplicates against existing items, scores priority
- Returns structured JSON: `{ title, description, category, priority, evidence, duplicate_warning, challenges: [{problem, solution}] }`
- After successful call, logs to `ai_usage_logs` table using service role (feature: `"stress_test"`)

**Mode: `"telemetry"`**
- Input: `{ mode: "telemetry" }`
- Checks for a `telemetry_events` table (graceful fallback if missing: "No telemetry data yet")
- Returns up to 5 gap/friction suggestions
- Logs to `ai_usage_logs` (feature: `"telemetry_analysis"`)

Config addition in `supabase/config.toml`:
```
[functions.analyze-telemetry]
verify_jwt = false
```

### UI Changes: `src/pages/dashboard/admin/AdminRoadmapPage.tsx`

**On each card** (hover-revealed, next to the edit/delete icons):
- A **"Run AI Test" button** (⚡ lightning bolt icon)
- Clicking it: shows a loading spinner, calls the edge function with the card's title + description + a list of other existing item titles (for duplicate detection)
- Result renders **inline below the card content**: evidence paragraph, challenges list (each shows `problem → solution`), a priority badge, and a duplicate warning if one is detected
- Cards that have been tested get an **"⚡ AI tested"** badge (state-only, resets on refresh — this is a testing tool not a persistent flag)

**In the Create/Edit dialog**:
- A **"Test with AI"** button below the description textarea
- Same behavior — shows results inside the dialog and auto-fills the Priority and Category dropdowns with AI suggestions (user can still change before saving)

---

## Feature 3 — AI Idea Intake (Feature Requests Tab)

### UI Changes: `src/components/helpdesk/FeatureRequests.tsx`

Add a collapsible **"AI Roadmap Intake"** panel above the existing feature request list. Has two sections:

**Idea Analyzer**
- Textarea: "Describe your feature idea..."
- Button: "Analyze with AI" → calls `analyze-telemetry` with `mode: "idea"`
- Results card shows: refined title, "Why it matters" (evidence text), priority badge (red/amber/green), duplicate warning if any, and challenges list (problem → solution)
- **"Add to Roadmap"** button saves the vetted item to `roadmap_items` table with AI-suggested title, description, category, and priority

**Telemetry Scan**
- Button: "Scan for Friction Points" → calls `analyze-telemetry` with `mode: "telemetry"`
- Displays up to 5 returned gap suggestions as simple cards

Panel is collapsed by default, toggled with a chevron button.

---

## Feature 4 — AI Usage Dashboard (Admin-only tab in Help Center)

### Database: New `ai_usage_logs` Table

```sql
CREATE TABLE public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  feature text NOT NULL,
  model text NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  estimated_cost_usd numeric(10,6) NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view ai usage logs" ON public.ai_usage_logs FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role can insert ai usage logs" ON public.ai_usage_logs FOR INSERT WITH CHECK (true);
```

Cost estimation formula used in edge functions: `(total_tokens / 1_000_000) * 0.15` (Gemini Flash pricing approximation).

### New Component: `src/components/helpdesk/AIUsageDashboard.tsx`

Admin-only, reads from `ai_usage_logs` filtered by selected date range.

**KPI Cards (top row)** — all with plain-English tooltips (no "tokens" jargon):
- Total Requests — "How many times AI was used across all features"
- Words Processed — `sum(total_tokens) × 0.75` — "Approximate words the AI read and wrote"
- Estimated Cost — `sum(estimated_cost_usd)` — "Approximate cost. See Lovable Billing for actuals."
- Features Using AI — distinct count of `feature`

**Bar Chart: Requests by Feature** (Recharts — already installed)
- X-axis: friendly names (Roadmap Stress Test, Behavior Analysis, etc.)
- Y-axis: request count

**Bar Chart: Daily AI Activity**
- X-axis: date (MM/dd), Y-axis: requests per day
- Filtered by date range selector

**Progress Bars: AI Models Used**
- Friendly names: "Gemini Flash (fast, efficient)", "Gemini Flash 2.5 (multimodal)", "Gemini Pro (most powerful)"
- Shows % of total + request count

**Progress Bars: Usage by Team Member**
- Joins `profiles` on `user_id`, shows display_name or email fallback

**Cost Breakdown Table**
- Columns: Feature | Requests | Words Processed | Est. Cost
- Sorted by cost descending

**Date range selector**: Last 7 / 30 / 90 days (pill buttons)

**Bottom link**: "View Lovable Billing →"

### Feature name → friendly label mapping used in UI:
- `stress_test` → "Roadmap Stress Test"
- `telemetry_analysis` → "Behavior Analysis"
- `collection_message` → "Collection Email"
- `plan_analysis` → "Plan Analysis"
- (others shown as-is if not in map)

### Help Center Update: `src/pages/dashboard/HelpCenterPage.tsx`

Add two admin-only tabs:
1. **AI Usage** — `<AIUsageDashboard />`
2. **Session Analytics** — `<ClarityPlaceholder />` (the Clarity setup preview)

Both tabs hidden for non-admin users using `useAdminRole()`.

---

## Files Changed

| File | Action |
|---|---|
| `supabase/functions/analyze-telemetry/index.ts` | New edge function (idea + telemetry modes, AI call, usage logging) |
| `supabase/config.toml` | Add `[functions.analyze-telemetry]` entry |
| `src/pages/dashboard/admin/AdminRoadmapPage.tsx` | Add "Run AI Test" button per card + in dialog, inline results, "⚡ AI tested" badge |
| `src/components/helpdesk/FeatureRequests.tsx` | Add AI Roadmap Intake panel (idea analyzer + telemetry scan + Add to Roadmap) |
| `src/components/helpdesk/AIUsageDashboard.tsx` | New — full admin AI usage dashboard with charts and cost table |
| `src/components/helpdesk/ClarityPlaceholder.tsx` | New — Clarity setup preview card with metric descriptions and code snippet |
| `src/pages/dashboard/HelpCenterPage.tsx` | Add admin-only "AI Usage" and "Session Analytics" tabs |
| DB migration | Create `ai_usage_logs` table with RLS |

No external API keys needed. Clarity script is NOT added — you paste it into `index.html` later in one step when you have your CitiSignal Clarity tag ID.
