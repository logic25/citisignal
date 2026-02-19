

# CitiSignal Rebrand + DD Reports Removal + Marketing Overhaul

## What's Changing

This update transforms the platform from "Property Guard" into **CitiSignal** -- a brand built around the idea that catching one violation early saves thousands. We'll also remove DD Reports from the UI (keeping the code for BinCheckNYC extraction later) and rewrite marketing copy to anchor on violation cost savings.

---

## 1. Brand Rename

Every instance of "Property Guard" and "Threshold" becomes **CitiSignal** across:

| File | Current Text | New Text |
|------|-------------|----------|
| `index.html` | "Property Guard - NYC Violation Tracking" | "CitiSignal - NYC Violation Monitoring" |
| `Navbar.tsx` | "Property Guard" | "CitiSignal" |
| `Hero.tsx` | "Property Guard syncs with 9 city agencies..." | "CitiSignal syncs with 9 city agencies..." |
| `HowItWorks.tsx` | "Property Guard syncs with 9 NYC agencies..." | "CitiSignal syncs with 9 NYC agencies..." |
| `Roadmap.tsx` | "What's next for Property Guard" | "What's next for CitiSignal" |
| `Footer.tsx` | "Threshold" | "CitiSignal" |
| `DashboardSidebar.tsx` | "Property Guard" | "CitiSignal" |
| `Auth.tsx` | "Property Guard" | "CitiSignal" |

### Icon Swap

Replace `Building2` with `Radio` (from lucide-react) across Navbar, Footer, Sidebar, Auth, and Hero to match the "signal" concept.

---

## 2. Color Palette Update

Shift the accent from amber to **signal red-orange** to convey urgency and alerts.

**Light mode changes** in `src/index.css`:
- `--accent`: `38 92% 50%` (amber) changes to `12 90% 55%` (signal orange-red)
- `--warning` stays amber at `38 92% 50%` (now distinct from accent)
- Gradient accent and shadow glow updated to use the new hue
- `.text-gradient` updated to use the new orange-red

**Dark mode**: Same accent shift applied.

---

## 3. Marketing Copy Rewrite

### Hero Section
- **Headline**: "One missed satisfactionviolation costs $25,000." / "CitiSignal catches it first."
- **Subheadline**: "Real-time violation monitoring across 9 NYC agencies. Auto-alerts via SMS, WhatsApp, or Telegram. The cheapest insurance your portfolio has."

### Features Section
- **Remove**: "Due Diligence Reports" card
- **Replace with**: "Property Tax Tracking" card -- "Track assessed values, payment status, and protest deadlines across your entire portfolio. Never miss a tax installment."
- **Section headline**: "Everything that protects your bottom line"

### CTA Section
- **Headline**: "A single ECB fine runs $2,000 to $25,000." / "CitiSignal pays for itself with one catch."

### Footer
- Update copyright to 2025, change name to CitiSignal

---

## 4. DD Reports Removal from UI

**Hidden but code preserved** for future BinCheckNYC extraction:

- Remove from `DashboardSidebar.tsx` nav items array
- Remove `/dashboard/dd-reports` route from `App.tsx`
- Remove DD Reports quick-link card from `DashboardOverview.tsx`
- Remove DD Reports feature card from `Features.tsx`
- **Keep all DD component files and edge function untouched** in the codebase

---

## Technical Details

### Files Modified (no new files created)

| File | Changes |
|------|---------|
| `src/index.css` | Accent color vars, gradients, glow shadow, text-gradient |
| `index.html` | Title + meta tags |
| `src/components/landing/Navbar.tsx` | Name + icon |
| `src/components/landing/Hero.tsx` | Full copy rewrite + icon + brand name |
| `src/components/landing/Features.tsx` | Remove DD card, add Tax card, update headline |
| `src/components/landing/HowItWorks.tsx` | Brand name in step 1 description |
| `src/components/landing/CTA.tsx` | ROI-focused copy rewrite |
| `src/components/landing/Roadmap.tsx` | Brand name in heading |
| `src/components/landing/Footer.tsx` | Name + copyright year |
| `src/components/dashboard/DashboardSidebar.tsx` | Name + icon + remove DD Reports nav item |
| `src/pages/Auth.tsx` | Name + icon |
| `src/pages/dashboard/DashboardOverview.tsx` | Remove DD Reports quick-link |
| `src/App.tsx` | Remove DD Reports route (keep import for now or remove) |

### Execution Order

1. Color palette (`src/index.css`)
2. Brand rename + icon swap across all files
3. Hero copy rewrite
4. Features update (remove DD, add Taxes)
5. CTA copy rewrite
6. HowItWorks, Roadmap, Footer copy updates
7. DD Reports removal from sidebar, routing, and overview
8. `index.html` meta tags

