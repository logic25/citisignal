

# Fix AI Chat: Button Overlap + CitiSignal Branding

## Issues to Fix

1. **"+ New" and "X" overlap** -- The Sheet component renders an automatic close button at `position: absolute; right: 16px; top: 16px`. The custom header's "+ New" button sits in the same spot, causing the overlap visible in the screenshot.

2. **Rename to CitiSignal AI** -- Brand the assistant as "CitiSignal AI" instead of generic "AI Assistant" to match the product identity.

## Changes

### 1. `src/components/dashboard/GlobalAIChatSheet.tsx`

- Change the header title from "AI Assistant" to **"CitiSignal AI"**
- Add `pr-10` (right padding) to the header bar so the "+ New" button doesn't collide with the Sheet's built-in X close button
- Update the SheetTitle (sr-only) from "AI Assistant" to "CitiSignal AI"
- Update the empty-state text to reference "CitiSignal AI"

### 2. `src/components/dashboard/GlobalAIChatButton.tsx`

- Update the aria-label from "Open AI Assistant" to "Open CitiSignal AI"

### 3. `src/components/dashboard/GlobalAIChatSheet.tsx` (ChatView header)

- Also add right padding to the chat-view header so the trash icon doesn't overlap with the X button either

## No other file changes needed.
