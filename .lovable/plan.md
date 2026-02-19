

# Unify AI Button: Purple Style with Global Functionality

## What Changes

### 1. Update the Global AI Button to match the purple style
The header button (`GlobalAIChatButton.tsx`) currently uses a small 40x40 square with the orange brand gradient. It will be restyled to match the purple floating button's look:
- Purple gradient: `from-violet-600 to-indigo-500`
- Pill shape with "CitiSignal AI" label (visible on desktop, icon-only on mobile)
- Purple shadow glow effect (`shadow-violet-500/25`)

### 2. Remove the floating Property AI button
The `PropertyAIWidget` component renders a duplicate floating button on property detail pages. Since the global button already opens a sheet that supports per-property conversations, the floating widget will be removed from `PropertyDetailPage.tsx`. The import and component usage will be deleted.

### 3. No functional changes
The `GlobalAIChatSheet` (conversation list, per-property chat, @ai commands) stays exactly the same. Only the trigger button's appearance changes.

## Technical Details

### `src/components/dashboard/GlobalAIChatButton.tsx`
- Replace the button's className to use `rounded-full bg-gradient-to-r from-violet-600 to-indigo-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/40 hover:scale-105` (matching PropertyAIWidget styling)
- Add a text label "CitiSignal AI" visible on sm+ screens
- Keep the conversation count badge

### `src/pages/dashboard/PropertyDetailPage.tsx`
- Remove the `PropertyAIWidget` import
- Remove the `<PropertyAIWidget ... />` component at the bottom of the page

### Files unchanged
- `GlobalAIChatSheet.tsx` -- all chat functionality stays as-is
- `PropertyAIWidget.tsx` -- file remains (unused, can be cleaned up later)
- `DashboardLayout.tsx` -- button already in the header, no changes needed

