

# Global AI Chat in Dashboard Header

## Problem
The AI chat button only appears on individual property detail pages. Users on the dashboard overview, calendar, violations list, or any other page have no access to the AI assistant.

## Solution
Add a persistent AI chat button to the dashboard top header bar (next to the notification bell). Clicking it opens a slide-out panel showing all property conversations, organized by property.

## How It Works

1. **Chat icon in the header** -- a `Sparkles` button sits next to the notification bell in `DashboardLayout.tsx`. It shows an unread badge when new messages arrive.

2. **Slide-out panel (Sheet)** -- clicking the button opens a right-side sheet with two views:
   - **Conversation list**: Shows all properties that have active AI conversations, sorted by most recent activity. Each row shows the property address, last message preview, and timestamp.
   - **Chat view**: Clicking a property opens that property's chat thread (reusing the same `property_ai_conversations` and `property_ai_messages` tables). Users can also start a new conversation by selecting a property from a dropdown.

3. **Property detail page keeps its FAB** -- when you're on a property detail page, the existing floating button still works as a quick shortcut. Both entry points share the same conversation data.

## New Components

### `GlobalAIChatButton` (header icon)
- Renders the `Sparkles` icon button in the header
- Queries all conversations for the current user to show total unread count
- Opens/closes the `GlobalAIChatSheet`

### `GlobalAIChatSheet` (slide-out panel)
- Uses Radix `Sheet` (already installed) opening from the right
- **List view**: Fetches all `property_ai_conversations` for the user, joined with `properties.address`, ordered by `updated_at` desc
- **Chat view**: When a conversation is selected, renders the message thread with the same send logic as `PropertyAIWidget` (reused into a shared hook or inline)
- Back button to return to conversation list
- "New Chat" button with a property selector dropdown

### `usePropertyAIChat` (shared hook -- optional extraction)
- Extracts the message fetching, sending, and streaming logic from `PropertyAIWidget` so both the FAB and the global sheet can share it
- Handles conversation creation, message persistence, realtime subscriptions, and AI streaming

## Changes by File

| File | Change |
|------|--------|
| `src/components/dashboard/DashboardLayout.tsx` | Add `GlobalAIChatButton` next to `NotificationBell` in the header |
| `src/components/dashboard/GlobalAIChatButton.tsx` | **New** -- icon button with unread badge, toggles the sheet |
| `src/components/dashboard/GlobalAIChatSheet.tsx` | **New** -- right-side sheet with conversation list and chat views |
| `src/hooks/usePropertyAIChat.ts` | **New** -- shared hook extracting chat logic from PropertyAIWidget |
| `src/components/properties/PropertyAIWidget.tsx` | Refactor to use `usePropertyAIChat` hook instead of inline logic (keeps FAB behavior identical) |

## Header Layout

```text
[                                              ] [Sparkles] [Bell]
```

The Sparkles button uses a violet/indigo gradient background to stand out from the muted notification bell, matching the existing FAB styling.

## Conversation List View (inside the sheet)

```text
+----------------------------------+
|  AI Assistant          [+ New]   |
+----------------------------------+
|  830 Rockaway Ave                |
|  "The open DOB violation..."     |
|  2 min ago                       |
+----------------------------------+
|  45 Main St                      |
|  "Zoning is R6A with a..."       |
|  1 hour ago                      |
+----------------------------------+
|  12 Park Place                   |
|  No messages yet                 |
|  Yesterday                       |
+----------------------------------+
```

## No Database Changes
The existing `property_ai_conversations` and `property_ai_messages` tables already support multi-property conversations per user. No schema changes needed.

## No New Dependencies
Uses existing Sheet, ScrollArea, Button, and Badge components.
