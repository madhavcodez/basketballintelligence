# Instance A — Foundation & Core Pages UI Overhaul

## Mission
Transform the Basketball Intelligence app from dark glass morphism to Apple.com-level premium light mode. You own the design system, layout, and core pages.

## Branch
Work on `ui-overhaul-a`. Create it immediately: `git checkout -b ui-overhaul-a`

---

## Design Specs

### Color Palette
| Token | Value | Usage |
|-------|-------|-------|
| bg-base | #FAFAFA | Page backgrounds |
| bg-card | #FFFFFF | Card surfaces |
| bg-secondary | #F5F5F7 | Secondary surfaces, alternating rows |
| text-primary | #1D1D1F | Headings, primary text |
| text-secondary | #6E6E73 | Descriptions, secondary labels |
| text-tertiary | #86868B | Captions, timestamps |
| accent-orange | #FF6B35 | CTAs, active nav, highlights (SPARINGLY) |
| accent-blue | #0071E3 | Links, interactive elements |
| border-subtle | rgba(0,0,0,0.06) | Card borders |
| border-medium | rgba(0,0,0,0.12) | Inputs, dividers |
| shadow-card | 0 2px 8px rgba(0,0,0,0.04), 0 12px 40px rgba(0,0,0,0.08) | Card elevation |
| shadow-hover | 0 4px 16px rgba(0,0,0,0.06), 0 20px 60px rgba(0,0,0,0.12) | Card hover |

### Typography
| Role | Font | Weight | Sizes |
|------|------|--------|-------|
| Display (page titles, heroes) | Syne | 800 | 48-96px |
| Body (everything else) | Inter | 400/500/600 | 14-18px |
| Stats/numbers | JetBrains Mono | 400/500 | 14-32px |

Import via next/font/google in layout.tsx:
```typescript
import { Inter, Syne, JetBrains_Mono } from 'next/font/google';
const syne = Syne({ variable: '--font-syne', subsets: ['latin'], display: 'swap' });
const jetbrainsMono = JetBrains_Mono({ variable: '--font-mono', subsets: ['latin'], display: 'swap' });
```

CSS classes: `font-display` = Syne, `font-body` = Inter, `font-mono` = JetBrains Mono

### 3D / Depth (CSS only)
- Cards: perspective(1200px) + rotateX/rotateY on hover via Framer Motion useMotionValue
- Player heroes: parallax layers via Framer Motion useScroll + useTransform
- Court visualizations: existing 3D perspective adjusted for light bg
- NO Three.js, no extra dependencies

### Cards (Replace GlassCard)
- Default: bg-white rounded-2xl shadow-card border border-black/[0.06]
- Hover: shadow deepens to shadow-hover, optional tilt
- tintColor: renders as 3px left border instead of overlay gradient
- NO backdrop-blur, NO rgba(255,255,255,...) backgrounds

### Navigation (Replace bottom nav with top)
- Apple-style sticky top navbar with subtle bottom border
- Logo left: "BI" or icon + "Basketball Intelligence" in Syne
- Center: Player Lab, Teams, Shot Lab, Zones, Compare, Film
- Right: Search trigger
- Mobile: hamburger → full-screen overlay nav
- This is the ONE place backdrop-blur is allowed (frosted glass navbar)

---

## NBA Asset Integration

### Player Headshots
- URL pattern: `https://cdn.nba.com/headshots/nba/latest/1040x760/{person_id}.png`
- The `players` table has `person_id` column with NBA numeric IDs
- LeBron = 2544, Curry = 201939, Embiid = 203954 (verified working)

### Team Logos
- URL pattern: `https://cdn.nba.com/logos/nba/{team_id}/global/L/logo.svg`
- `team_traditional_regular` table has `team_id`
- LAL = 1610612747, BOS = 1610612738, GSW = 1610612744 (verified)

### NBA_TEAM_IDS (all 30 teams)
```
ATL:1610612737 BOS:1610612738 BKN:1610612751 CHA:1610612766
CHI:1610612741 CLE:1610612739 DAL:1610612742 DEN:1610612743
DET:1610612765 GSW:1610612744 HOU:1610612745 IND:1610612754
LAC:1610612746 LAL:1610612747 MEM:1610612763 MIA:1610612748
MIL:1610612749 MIN:1610612750 NOP:1610612740 NYK:1610612752
OKC:1610612760 ORL:1610612753 PHI:1610612755 PHX:1610612756
POR:1610612757 SAC:1610612758 SAS:1610612759 TOR:1610612761
UTA:1610612762 WAS:1610612764
```

---

## Task List (Execute In Order)

### Phase 1: Foundation (do first — everything else depends on this)
- [ ] A1. Create branch `ui-overhaul-a`
- [ ] A2. Rewrite `src/app/globals.css` — full light mode, remove all dark/glass styles
- [ ] A3. Rewrite `src/lib/design-tokens.ts` — light palette, new shadows, Syne/JetBrains font refs
- [ ] A4. Rewrite `tailwind.config.ts` — light theme, new font families, remove glass utilities
- [ ] A5. Update `src/app/layout.tsx` — import Syne + JetBrains Mono fonts, suppressHydrationWarning, remove "dark" class
- [ ] A6. Create `src/lib/nba-assets.ts` — playerHeadshotUrl, teamLogoUrl, NBA_TEAM_IDS, TEAM_NAME_TO_ID
- [ ] A7. Update `next.config.ts` — add cdn.nba.com to images.remotePatterns
- [ ] A8. Update `src/lib/db.ts` — add `person_id as personId` to getPlayer, searchPlayers, getTopScorers, getFeaturedPlayers queries (JOIN with players table which has person_id)
- [ ] **BUILD CHECK**: `npx next build` — fix any errors before continuing

### Phase 2: Core Components
- [ ] A9. Rewrite `src/components/ui/GlassCard.tsx` — white cards, Apple shadows, optional tilt-on-hover, left-border tintColor
- [ ] A10. Rewrite `src/components/ui/PlayerAvatar.tsx` — add playerId prop, NBA CDN headshot with next/image, fallback to initials
- [ ] A11. Create `src/components/ui/TeamLogo.tsx` — teamId prop, NBA CDN logo with next/image, fallback to abbreviation text
- [ ] A12. Update `src/components/ui/SectionHeader.tsx` — dark text, gray eyebrow (not orange)
- [ ] A13. Update `src/components/ui/MetricChip.tsx` — light bg, dark text
- [ ] A14. Update `src/components/ui/Badge.tsx` — outlined style on white
- [ ] A15. Update `src/components/ui/SearchBar.tsx` — white bg, subtle border, no orange glow
- [ ] A16. Update `src/components/ui/SkeletonLoader.tsx` — light gray shimmer
- [ ] A17. Remove pulsing animations from `PlayoffFlair.tsx`, `SeasonTypeToggle.tsx` (static indicators only)
- [ ] **BUILD CHECK**: `npx next build`

### Phase 3: Layout
- [ ] A18. Rewrite `src/components/layout/AppShell.tsx` — top sticky nav, remove bottom nav, Apple-style
- [ ] **BUILD CHECK**: `npx next build`

### Phase 4: Pages
- [ ] A19. Redesign `src/app/page.tsx` — FIX duplicate /explore key, Syne hero (no gradient), search bar, headshots in top scorers, team logos in standings, white cards
- [ ] A20. Redesign `src/app/player/[name]/page.tsx` — large headshot hero with parallax, Syne name, JetBrains stats, white cards
- [ ] A21. Redesign `src/app/player/[name]/timeline/page.tsx` — light mode
- [ ] A22. Redesign `src/app/team/[abbr]/page.tsx` — team logo hero, roster with headshots, light mode
- [ ] A23. Redesign `src/app/explore/page.tsx` — search-first, player cards with headshots, team logos
- [ ] A24. Redesign `src/app/compare/page.tsx` — side-by-side headshots, clean stat bars, light mode
- [ ] **BUILD CHECK**: `npx next build`
- [ ] A25. Commit all work: `git add -A && git commit -m "feat: complete light mode design system + core pages"`

---

## Cron Job: Self-Check Every 30 Minutes

After completing Phase 1, set up this cron job to verify your work continuously:

```bash
# Create self-check script
cat > /tmp/instance-a-check.sh << 'SCRIPT'
#!/bin/bash
cd ~/OneDrive/Desktop/basketballintelligence
git checkout ui-overhaul-a 2>/dev/null

echo "=== Instance A Self-Check $(date) ==="

# Build check
echo "--- Build ---"
npx next build 2>&1 | tail -5

# Grep for dark mode remnants in files I own
echo "--- Dark Mode Remnants ---"
for pattern in "bg-dark-" "text-chrome-" "bg-glass-" "border-glass-" "backdrop-blur-xl" "rgba(255,255,255"; do
  count=$(grep -rl "$pattern" src/app/globals.css src/lib/design-tokens.ts src/components/ui/ src/components/layout/ src/app/page.tsx src/app/player/ src/app/team/ src/app/explore/ src/app/compare/ 2>/dev/null | wc -l)
  [ "$count" -gt 0 ] && echo "  FOUND $count files with '$pattern'"
done

# Check NBA CDN integration
echo "--- NBA Assets ---"
grep -l "cdn.nba.com" src/components/ui/PlayerAvatar.tsx src/components/ui/TeamLogo.tsx src/lib/nba-assets.ts 2>/dev/null | wc -l | xargs -I{} echo "  {} files reference cdn.nba.com"

# Check font imports
echo "--- Fonts ---"
grep -l "Syne" src/app/layout.tsx 2>/dev/null && echo "  Syne imported" || echo "  MISSING Syne import"
grep -l "JetBrains" src/app/layout.tsx 2>/dev/null && echo "  JetBrains Mono imported" || echo "  MISSING JetBrains Mono import"

echo "=== Check Complete ==="
SCRIPT
chmod +x /tmp/instance-a-check.sh
```

Run it manually after each phase, or schedule it:
```bash
# Run self-check every 30 minutes for 3 hours (6 times)
for i in $(seq 1 6); do
  (sleep $((i * 1800)) && /tmp/instance-a-check.sh >> /tmp/instance-a-log.txt 2>&1) &
done
echo "Scheduled 6 self-checks over 3 hours"
```

---

## Rules
1. NEVER use glass morphism (backdrop-blur, rgba white bg) on cards. ONLY on the navbar.
2. Syne ONLY for page titles and hero headings. Everything else is Inter.
3. JetBrains Mono ONLY for numbers/stats/scores.
4. Orange (#FF6B35) SPARINGLY — CTAs, active nav, key highlights. Most UI is black/gray/white.
5. Every player display should attempt headshots. Every team display should attempt logos.
6. Keep all spring animations for data viz. Remove ALL infinite/pulsing animations.
7. Don't change API response shapes.
8. Build must pass after every phase.
