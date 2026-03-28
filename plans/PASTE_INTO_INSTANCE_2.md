# PASTE THIS INTO INSTANCE 2 (Hot Zones V2)

You're ahead of schedule. Here's more work to make the zones feature the most visually stunning page on the entire platform. Keep the same file ownership rules.

## ROUND 2: Deepen the Zones Experience

1. **Player Zone Deep Dive** (`src/app/zones/[player]/page.tsx`) — If this page is basic, make it EPIC:
   - Hero section: xl-sized heatmap (700px) with the player's name overlaid in huge text
   - Mode toggle row: Efficiency | Frequency | Makes (three pill buttons)
   - Season selector dropdown (glass pill, all available seasons)
   - Zone breakdown table sorted by attempts — each row has a colored bar and mini percentage
   - Shot Signature card (the "Perimeter Sniper" / "Paint Dominator" narrative card)
   - "Similar Shooters" section — find 5 players with the most similar zone distribution (cosine similarity on attempt percentages per zone)

2. **Zone Trend Chart** — For the player deep dive, add a career zone trend: a small area chart showing how their shot distribution changed over their career. X-axis = seasons, Y-axis = % of attempts from each zone. Stacked area chart using Recharts. Shows the "3-point revolution" for players who shifted their game.

3. **Interactive Hexbin Polish** — On the HotZoneChart:
   - Hexbins should scale in from center outward on mount (stagger 0.002s per hex)
   - Hover a hex: enlarge 1.3x, show tooltip with exact FG%, attempts, makes
   - Click a zone: highlight all hexbins in that zone, dim others
   - Smooth color transitions when switching between Efficiency/Frequency/Makes modes
   - Make sure the d3-hexbin import is client-side only (dynamic import or 'use client')

4. **Zone Comparison Page Enhancement** — The compare section on `/zones` should be dramatic:
   - Two full-sized heatmaps side by side (md size, ~360px each)
   - Below: zone-by-zone comparison bars (like Instance 3's stat bars but for zones)
   - Each bar shows Player 1 FG% vs Player 2 FG% vs League Average (three markers)
   - Winner of each zone gets a subtle glow
   - Overall "Zone Score" — a single number summarizing who's the better shooter (weighted ePts/attempt across all zones)

5. **"Shot DNA" Card** — Create `src/components/cards/ShotDNACard.tsx`. A compact visual fingerprint:
   - 7 small colored circles in a row (one per zone), sized by attempt volume, colored by efficiency
   - Below: one-line text like "3PT-heavy, elite from corners, avoids mid-range"
   - This card can be embedded on the player page, compare page, anywhere

## ROUND 3: Make It Social / Shareable

6. **Shareable Heatmap Image** — Add a "Share" button on the player zone page. When clicked, render the heatmap + player name + key stats into a styled div, then use `html2canvas` or just make it look screenshot-perfect with a dark background, logo watermark, and clean layout. People should WANT to screenshot this.

7. **"Zone of the Day"** — On the zones landing page, feature a random interesting stat: "Did you know? Nikola Jokic shoots 68.2% from the restricted area — highest among centers this season." Query for extreme values per zone and display one randomly.

8. **Zone Leaderboard Depth** — The zone leaders section should have:
   - Minimum 100 attempts filter (toggle between 50/100/200)
   - Each leader row shows: rank, player name, FG%, attempts, mini court preview
   - Click a leader to jump to their `/zones/[player]` page
   - Tabs for all 7 zones (not just the main ones)

## ROUND 4: Performance + Polish

9. **Lazy load d3** — Dynamically import d3-hexbin and d3-scale only in client components. Wrap the HotZoneChart in a Suspense boundary with a court skeleton placeholder.

10. **SQL performance** — All zone queries should have `WHERE PLAYER_NAME = ? AND season = ?` with index usage. Pre-aggregate in SQL: `SELECT SHOT_ZONE_BASIC, COUNT(*) as attempts, SUM(SHOT_MADE_FLAG) as makes FROM shots WHERE ...GROUP BY SHOT_ZONE_BASIC`. Never pull 5000 raw shots when you can aggregate.

11. **Loading states** — Court skeleton: gray zones pulsing with shimmer animation. Stats: SkeletonLoader rows. The transition from skeleton to real data should be a smooth fade, not a pop.

12. **Empty states** — "No shot data for this season" with a muted dashed-outline court. "Player not found" with search suggestion.

13. **Mobile** — At 375px: heatmap goes full-width, zone labels shrink, comparison stacks vertically, leaderboard rows compact. Touch targets 44px minimum.

Run `npm run build` after each chunk. This page should make people say "holy shit" when they see it.
