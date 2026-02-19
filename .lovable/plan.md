

# Sidebar Cleanup + AI Chat Visibility + Marketing Update

## 1. Sidebar: Flat List with Financial Divider + Avatar Popover

Reorder the nav items to follow the natural property management workflow, with a thin divider before the financial tools. Merge Settings, Sign Out, and user info into a single avatar-triggered popover.

### New nav order

```text
[CitiSignal Logo]        [collapse arrow]

Overview
Properties
Violations
Work Orders
Vendors
Applications
Notifications
Calendar
─────────────────  (1px divider, no label)
CAM Charges
Owner Statements
Reports

ADMIN (if isAdmin)
  Admin
  API Logs
  Users

--- bottom ---
[Avatar circle]  -->  click opens popover:
  user@email.com
  Property Owner
  ──────────
  Settings
  Sign Out
```

### Technical changes in `DashboardSidebar.tsx`

- Split `navItems` into `operationsItems` (Overview through Calendar) and `financeItems` (CAM, Owner Statements, Reports)
- Render a `<Separator />` between the two groups (visible in both collapsed and expanded states)
- Remove the separate Settings link, Sign Out button, and user info sections at the bottom
- Replace with a single avatar circle that opens a Radix `Popover` containing: email, role label, a separator, Settings link, and Sign Out button
- When collapsed: avatar shows as a circle with initial; popover opens to the right
- Import `Popover`, `PopoverTrigger`, `PopoverContent` from `@/components/ui/popover` and `Separator` from `@/components/ui/separator`

---

## 2. AI Chat: Visible on All Property Tabs

Currently the `PropertyAIWidget` (floating action button) only renders inside `PropertyOverviewTab`. Moving it to `PropertyDetailPage` makes it accessible from every tab (Violations, Work Orders, Documents, etc.).

### Changes

- **`PropertyDetailPage.tsx`**: Import `PropertyAIWidget` and render it after the `</Tabs>` closing tag (but before the `EditPropertyDialog`), passing the same props it currently receives in Overview
- **`PropertyOverviewTab.tsx`**: Remove the `PropertyAIWidget` import and render (lines 28 and 632-650). Remove `documents` and `workOrders` from the component's props interface since they were only needed for the AI widget

---

## 3. Marketing: Replace Tax Card with AI Assistant Card

The "Property Tax Tracking" card in Features is misleading (taxes are a tab, not a standalone feature). Replace it with an **AI Property Assistant** card that highlights the chat capability -- making it visible to prospects before they sign up.

### Changes to `Features.tsx`

Replace the last feature entry:

| Field | Old | New |
|-------|-----|-----|
| icon | `BarChart3` | `Sparkles` |
| title | Property Tax Tracking | AI Property Assistant |
| description | Track assessed values... | Ask questions about any property in plain English. Get instant answers about violations, deadlines, and lease terms -- backed by your actual data. |
| highlight | Portfolio-Wide | AI-Powered |
| color | muted-foreground | primary |

Move the "AI-Powered" badge from Lease Q&A to this new card, and give Lease Q&A the badge "Document Intelligence" instead.

---

## Files Modified

| File | What changes |
|------|-------------|
| `src/components/dashboard/DashboardSidebar.tsx` | Reorder nav, add divider, replace bottom section with avatar popover |
| `src/pages/dashboard/PropertyDetailPage.tsx` | Add `PropertyAIWidget` render at page level |
| `src/components/properties/detail/PropertyOverviewTab.tsx` | Remove `PropertyAIWidget` render and unused imports/props |
| `src/components/landing/Features.tsx` | Replace Tax card with AI Assistant card, swap badges |

No new files. No database changes. No new dependencies.
