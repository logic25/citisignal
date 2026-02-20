
# Interactive Product Tour

## What This Adds

A step-by-step in-app tour that guides a user through the real dashboard UI — highlighting actual elements with a spotlight overlay and tooltip, one step at a time. Think of it like a guided demo mode that shows your instructor exactly how CitiSignal works without them needing to figure it out themselves.

## How It Works

```text
User clicks "Take a Tour" (Help Center or Dashboard)
        |
Spotlight appears on the Sidebar → "This is your nav"
        |
Highlights Properties → "Add and monitor buildings here"
        |
Highlights Violations tab → "Live violations from 9 agencies"
        |
Highlights Work Orders → "Dispatch vendors from here"
        |
Highlights Notifications bell → "Alerts go here"
        |
Highlights AI Chat button → "Ask anything about your portfolio"
        |
Tour ends → Confetti / "You're ready!" message
```

## What Gets Built

### 1. Tour Overlay System (`TourProvider` + `TourSpotlight`)
A lightweight overlay system built from scratch (no external library needed) with:
- A semi-transparent dark backdrop that cuts out around the highlighted element
- A tooltip card positioned next to the highlighted element (auto-positions above/below/left/right to stay on screen)
- "Previous", "Next", and "Skip Tour" buttons
- Step counter (e.g. "3 of 8")
- Smooth transition between steps

### 2. Tour Steps Definition
Each step references a CSS selector or element ID to highlight:

| Step | Highlight | Message |
|---|---|---|
| 1 | Sidebar nav | "Your command center. Everything lives here." |
| 2 | Properties nav item | "Start by adding your NYC buildings." |
| 3 | Violations nav item | "Live violations from DOB, FDNY, HPD, and 6 more agencies." |
| 4 | Work Orders nav item | "Create work orders and dispatch vendors — all from here." |
| 5 | Notifications bell | "This is where your alerts land." |
| 6 | AI Chat button | "Ask CitiSignal anything about your portfolio in plain English." |
| 7 | Help Center link | "Need help? Guides and step-by-step instructions live here." |

### 3. Tour Entry Points
Two ways to launch the tour:
- **"Take a Tour" button** added to the Dashboard Overview page header (visible to all users)
- **"Restart Tour" button** in the Help Center page (so your instructor or any user can re-run it any time)

### 4. Tour State
- Tour progress is stored in `localStorage` so it does not re-trigger every login
- The "Restart Tour" button in Help Center resets it
- The existing Onboarding Wizard is separate and unchanged

## Technical Notes
- No external tour library is needed — the overlay is built with a fixed-position `div` + `getBoundingClientRect()` to locate the highlighted element
- Works on both desktop and mobile (tooltip repositions on small screens)
- Does not interfere with the existing Onboarding Wizard — the wizard runs once on first login, the tour can be run any time after
- Tour steps use `data-tour` attributes added to the relevant elements (e.g. `data-tour="properties-nav"`) so the selector logic stays clean
- Auto-scrolls the sidebar into view if a step's target is off-screen
