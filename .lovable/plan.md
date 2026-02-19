

# Fix CitiSignal AI Button Color to Match Brand

## Problem
The AI chat button uses a violet/indigo gradient (`from-violet-600 to-indigo-500`) that exists nowhere in the brand palette. CitiSignal's identity is built on:
- **Navy** (primary) -- trust and professionalism
- **Signal orange** (accent) -- urgency and alerts

A purple button feels disconnected from a monitoring/alerting product.

## Recommendation
Use the **brand accent gradient** (signal orange) for the AI button. This ties the assistant to the product's core identity -- "your signal, your assistant." The orange also creates a natural visual hierarchy: it draws attention without clashing with the navy used everywhere else.

## Changes

### `src/components/dashboard/GlobalAIChatButton.tsx`
Replace the gradient class on the button:

| Before | After |
|--------|-------|
| `bg-gradient-to-r from-violet-600 to-indigo-500` | `bg-gradient-to-r from-[hsl(12,90%,55%)] to-[hsl(16,85%,60%)]` |

This matches `--gradient-accent` already defined in `index.css`, keeping the design system consistent.

### No other files need changes
The Sheet, branding text, and conversation UI all remain the same.
