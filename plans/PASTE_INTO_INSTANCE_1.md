# PASTE THIS INTO INSTANCE 1 (Playoff Framework)

You're ahead of schedule. Here's more work for tonight. Keep the same file ownership rules.

## ROUND 2: Build the UI + Wire Everything

You built the data layer and APIs but the toggle doesn't exist yet. Build it NOW:

1. **SeasonTypeToggle.tsx** — The animated 3-state pill (Regular | Playoffs | Combined). Sliding backdrop via Framer Motion layoutId. Glass morphism. Accent glow per mode (blue/orange/violet). Compact variant for mobile. Disabled state when no playoff data. This is the signature UI element of the whole feature — make it beautiful.

2. **SeasonTypeBadge.tsx** — Small inline badge (Trophy icon for playoffs, BarChart3 for regular, Layers for combined). Used in card headers.

3. **Wire into AppShell.tsx** — Wrap children in SeasonTypeProvider. Add the toggle fixed top-right with backdrop blur. Compact on mobile.

4. **Upgrade EVERY existing page** to consume `useSeasonType()` and call v2 APIs with `?seasonType=`. Pages: home (page.tsx), player lab, compare, shot-lab (read-only — just pass the param to existing fetches), quiz/play, lineup, team, stories, ask. Each page should show a brief loading shimmer when the toggle switches.

5. **Persist to localStorage + URL sync** — `?seasonType=playoffs` query param support. Restore from localStorage on mount.

6. **Ingest script** — `src/scripts/ingest-playoffs.ts` that reads `~/basketball_data/player_playoffs*.csv` and creates/populates the playoff tables. Run with `npx tsx`.

## ROUND 3: Go Deeper — Playoff Bracket + Playoff Stories

Now make playoffs mode feel SPECIAL, not just "same page with different numbers":

7. **Playoff Bracket Visualization** — Create `src/components/ui/PlayoffBracket.tsx`. When in playoffs mode, the home page shows an interactive bracket instead of standings. 16-team bracket, glass cards for each matchup, series scores, winner highlighted. Even if you don't have real bracket data, build the component with sample data and wire it to show when `seasonType === 'playoffs'`.

8. **Playoff Storylines** — On the stories page, when in playoffs mode, generate playoff-specific narratives: "LeBron averaged 32.4 PPG in the 2020 Playoffs" type cards. Query the playoff stats tables, find interesting outliers (highest PPG in a playoff run, most blocks in a series, etc.), render them as story cards.

9. **"Playoff Mode" Visual Flair** — When in playoffs mode, subtly change the app's vibe:
   - Add a very subtle warm orange gradient tint to the background (barely visible, like 2% opacity)
   - The nav bar accent shifts from orange to a playoff-fire gradient
   - Section headers get a tiny flame icon
   - This should be toggleable via the SeasonTypeProvider context

10. **Season Awards Section on Player Page** — When viewing a player in playoffs mode, show a "Playoff Accolades" section: Finals MVP, Conference Finals appearances, total playoff games/points/etc. Compute from the data.

## ROUND 4: Edge Cases + Bulletproofing

11. **Graceful degradation** — If playoff tables don't exist yet, every v2 route returns `{ data: [...regular data...], playoffAvailable: false, message: "Playoff data loading..." }`. The toggle shows "Playoffs" as disabled with a tooltip "Data arriving soon".

12. **Error boundaries** — If a playoff query fails mid-session (table locked, etc.), silently fall back to regular season data and show a small toast.

13. **Keyboard shortcuts** — When the toggle is focused, press 1/2/3 to switch modes.

14. **A11y** — ARIA labels on the toggle, announce mode change to screen readers.

Run `npm run build` after each major chunk. Fix any errors before moving on. You have all night — make this feature feel like it was built by Apple's design team.
