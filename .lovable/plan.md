
# Landing Page Color Scheme Overhaul

## Problem
The navy + orange palette is conceptually right for CitiSignal (trust + urgency), but the execution has three issues:
- Orange is overused -- when everything screams "urgent," nothing does
- Light sections feel disconnected from dark hero/CTA sections
- Feature cards lack depth and visual hierarchy

## Solution: Refined Navy + Orange with Teal Secondary

Keep the core identity but add a **teal/cyan secondary** (`190 80% 50%`) for informational, non-urgent elements. This creates three semantic layers:

| Color | Role | Where |
|-------|------|-------|
| Navy (`222 47% 11-15%`) | Trust, brand, structure | Hero bg, navbar, footer, headings |
| Orange (`12 90% 55%`) | Urgency, action, alerts | Primary CTAs only, violation badges, "signal" accent |
| Teal (`190 80% 42%`) | Information, features, calm | Feature icons, secondary badges, info elements, step numbers |

## Changes

### 1. Update CSS Variables (`src/index.css`)
- Add a new `--info` color token: `190 80% 42%` (teal)
- Lighten `--background` slightly for better card contrast: `220 20% 98%`
- Add `--gradient-feature` for the features section: subtle warm-to-cool gradient
- Adjust `--accent` usage -- keep it but reduce where it auto-applies

### 2. Update Tailwind Config (`tailwind.config.ts`)
- Add `info` color token to the theme colors (with foreground)
- This makes `bg-info`, `text-info`, etc. available throughout

### 3. Rework Hero Section (`src/components/landing/Hero.tsx`)
- Make headline white with stronger contrast (currently readable but could pop more)
- Change the "CitiSignal catches it first" gradient to be more vivid
- Make the channel pills use teal icons instead of orange -- these are informational, not urgent
- Add a subtle gradient overlay to improve text contrast

### 4. Refine Features Section (`src/components/landing/Features.tsx`)
- Give feature cards subtle shadows and a light border for depth
- Use teal for feature icon backgrounds instead of having all icons in different random colors
- Keep the "9 Agencies" / "3 Channels" badges but use muted teal instead of plain gray
- Add a light background tint to the section (`bg-secondary/50`)

### 5. Update How It Works (`src/components/landing/HowItWorks.tsx`)
- Change step number circles from navy to teal -- they're informational, not brand elements
- Add a subtle connecting line between steps for visual flow

### 6. Tighten Pricing Section (`src/components/landing/Pricing.tsx`)
- Keep the orange "Most Popular" badge (urgency = correct here)
- Use teal checkmarks instead of green -- creates consistency with the new palette
- Add subtle card hover effects for interactivity

### 7. Polish CTA Section (`src/components/landing/CTA.tsx`)
- Keep orange for the primary "Claim My Spot" button (correct usage)
- Change the green status dots to teal for palette consistency

### 8. Update Social Proof (`src/components/landing/SocialProof.tsx`)
- Use teal for stat numbers/highlights instead of orange
- Orange should only appear if something is "urgent" or action-oriented

### 9. Footer polish (`src/components/landing/Footer.tsx`)
- System status dot: teal instead of green (palette consistency)

## Technical Details

### New CSS token additions in `src/index.css`:
- Light mode: `--info: 190 80% 42%; --info-foreground: 0 0% 100%;`
- Dark mode: `--info: 190 75% 50%; --info-foreground: 222 47% 11%;`

### New Tailwind token in `tailwind.config.ts`:
```
info: {
  DEFAULT: "hsl(var(--info))",
  foreground: "hsl(var(--info-foreground))",
}
```

### Files to modify:
1. `src/index.css` -- add info tokens, adjust background
2. `tailwind.config.ts` -- add info color
3. `src/components/landing/Hero.tsx` -- teal for info pills, stronger headline contrast
4. `src/components/landing/Features.tsx` -- teal icon bgs, card depth
5. `src/components/landing/HowItWorks.tsx` -- teal step numbers
6. `src/components/landing/Pricing.tsx` -- teal checkmarks, card polish
7. `src/components/landing/CTA.tsx` -- teal status dots
8. `src/components/landing/SocialProof.tsx` -- teal stat highlights
9. `src/components/landing/Footer.tsx` -- teal status dot

### What stays the same:
- Navy hero/CTA backgrounds (brand identity)
- Orange primary CTA buttons ("Claim My Spot", "Request Invite")
- Orange for violation/alert related UI
- Space Grotesk + Inter font pairing
- Overall page layout and section structure

## Result
Orange regains its power as the "act now" signal. Teal handles everything informational. Navy stays the trusted backbone. The page feels cohesive instead of monochrome-with-one-accent.
