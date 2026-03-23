# DATA_MANIFEST.md

> **Source of truth for all basketball data in the Basketball Intelligence Playground.**
> Maintained by the Data Manager agent. Last updated: 2026-03-23.

---

## Overview

| Item | Value |
|---|---|
| Database path | `data/basketball.db` |
| Database size | ~1.7 GB |
| Total tables | 13 |
| Raw CSV source | `~/Downloads/sportsdata/` (433 CSV files, 389 top-level entries) |
| Ingestion script | `scripts/ingest.py` |
| Data refresh | Batch (not live) |

---

## Tables

### 1. `players`

Biographical and career metadata for all NBA/ABA players.

| Field | Type | Notes |
|---|---|---|
| Player | TEXT | Full name |
| HOF | TEXT | Hall of Fame flag |
| Active | TEXT | Currently active flag |
| From | INTEGER | First season year |
| To | INTEGER | Last season year |
| Pos | TEXT | Position(s) |
| Height | TEXT | Height string (e.g. "6-6") |
| Weight | REAL | Weight in lbs |
| BirthDate | TEXT | Birth date |
| College | TEXT | College attended |
| player_id | INTEGER | Internal row ID |

- **Source CSV:** `all_player_bios.csv`
- **Row count:** 5,407
- **Date range:** Careers spanning 1947–2026
- **Known issues:**
  - 10 rows with NULL BirthDate
  - Multiple players share the same name (e.g. Charles Jones ×3, Charles Smith ×3, George Johnson ×3) — this is expected for common NBA names across eras
  - `player_id` is rowid-based, not a stable NBA API ID

---

### 2. `player_stats_pergame`

Per-game season averages from Basketball Reference.

| Field | Type | Notes |
|---|---|---|
| Season | INTEGER | Year (e.g. 2025 = 2024-25 season) |
| Player | TEXT | Player name |
| Age | REAL | Age during season |
| Tm | TEXT | Team abbreviation (TOT for traded players) |
| Pos | TEXT | Position |
| G, GS | REAL | Games played / started |
| MP | REAL | Minutes per game |
| FG, FGA, FGPct | REAL | Field goals |
| 3P, 3PA, 3PPct | REAL | Three-pointers |
| 2P, 2PA, 2PPct | REAL | Two-pointers |
| eFGPct | REAL | Effective FG% |
| FT, FTA, FTPct | REAL | Free throws |
| ORB, DRB, TRB | REAL | Rebounds |
| AST, STL, BLK, TOV, PF | REAL | Box score stats |
| PTS | REAL | Points per game |

- **Source CSVs:** `player_pergame_1980_1995.csv`, `player_pergame_1996_2005.csv`, `player_pergame_2006_2015.csv`, `player_pergame_2016_2025.csv`
- **Row count:** 24,662
- **Date range:** Seasons 1980–2025
- **Known issues:**
  - 46 rows with NULL PTS (likely incomplete season rows or historical data gaps)
  - Duplicate rows exist for players traded mid-season (one row per team + TOT total)

---

### 3. `player_stats_advanced`

Advanced per-season metrics from Basketball Reference.

| Field | Type | Notes |
|---|---|---|
| Season | INTEGER | Year |
| Player | TEXT | Player name |
| Age | REAL | Age |
| Tm | TEXT | Team |
| Pos | TEXT | Position |
| G, GS, MP | REAL | Playing time |
| PER | REAL | Player Efficiency Rating |
| TSPct | REAL | True Shooting % |
| 3PAr, FTr | REAL | Rate stats |
| ORBPct, DRBPct, TRBPct | REAL | Rebound % |
| ASTPct, STLPct, BLKPct, TOVPct | REAL | Assist/steal/block/turnover % |
| USGPct | REAL | Usage rate |
| OWS, DWS, WS, WS48 | REAL | Win Shares |
| OBPM, DBPM, BPM | REAL | Box Plus/Minus |
| VORP | REAL | Value Over Replacement |
| Awards | TEXT | In-season awards |

- **Source CSVs:** `player_advanced_1980_2005.csv`, `player_advanced_2006_2015.csv`, `player_advanced_2016_2025.csv`
- **Row count:** 24,662
- **Date range:** Seasons 1980–2025
- **Known issues:**
  - Shares season range and player-team row structure with `player_stats_pergame`

---

### 4. `player_game_logs`

Individual game records for each player (NBA API).

| Field | Type | Notes |
|---|---|---|
| SEASON_ID | INTEGER | Season ID (e.g. 22024) |
| PLAYER_ID | INTEGER | NBA API player ID |
| PLAYER_NAME | TEXT | Player name |
| TEAM_ID | INTEGER | NBA API team ID |
| TEAM_ABBREVIATION | TEXT | Team abbreviation |
| TEAM_NAME | TEXT | Team full name |
| GAME_ID | INTEGER | Game ID |
| GAME_DATE | TEXT | Date (YYYY-MM-DD) |
| MATCHUP | TEXT | e.g. "LAL vs. GSW" |
| WL | TEXT | Win or Loss |
| MIN | INTEGER | Minutes played |
| FGM, FGA, FG_PCT | — | Field goals |
| FG3M, FG3A, FG3_PCT | — | Three-pointers |
| FTM, FTA, FT_PCT | — | Free throws |
| OREB, DREB, REB | INTEGER | Rebounds |
| AST, STL, BLK, TOV, PF | INTEGER | Box score |
| PTS | INTEGER | Points |
| PLUS_MINUS | INTEGER | +/- |

- **Source CSVs:** `nba_player_gamelogs_*.csv` (multiple per season)
- **Row count:** 452,108
- **Date range:** 2007-10-30 to 2025-04-13
- **Known issues:**
  - 1,690 distinct PLAYER_IDs have no match in the `players` table — NBA API IDs don't map 1:1 to the `players.player_id` (rowid-based). Cross-table joins require name matching.

---

### 5. `shots`

Shot chart data with court coordinates.

| Field | Type | Notes |
|---|---|---|
| GAME_ID | INTEGER | Game ID |
| GAME_EVENT_ID | INTEGER | Event ID within game |
| PLAYER_ID | INTEGER | NBA API player ID |
| PLAYER_NAME | TEXT | Player name |
| TEAM_ID | INTEGER | NBA API team ID |
| TEAM_NAME | TEXT | Team name |
| PERIOD | INTEGER | Quarter |
| MINUTES_REMAINING | INTEGER | Minutes left in period |
| SECONDS_REMAINING | INTEGER | Seconds left |
| EVENT_TYPE | TEXT | "Made Shot" or "Missed Shot" |
| ACTION_TYPE | TEXT | Shot action description |
| SHOT_TYPE | TEXT | "2PT Field Goal" / "3PT Field Goal" |
| SHOT_ZONE_BASIC | TEXT | Zone category |
| SHOT_ZONE_AREA | TEXT | Court area |
| SHOT_ZONE_RANGE | TEXT | Distance range |
| SHOT_DISTANCE | INTEGER | Distance in feet |
| LOC_X | INTEGER | X coordinate |
| LOC_Y | INTEGER | Y coordinate |
| SHOT_ATTEMPTED_FLAG | INTEGER | Always 1 |
| SHOT_MADE_FLAG | INTEGER | 1 = made, 0 = missed |
| GAME_DATE | INTEGER | Date (stored as integer YYYYMMDD) |
| HTM | TEXT | Home team abbreviation |
| VTM | TEXT | Visitor team abbreviation |
| season | TEXT | Season string (e.g. "2024-25") |

- **Source CSVs:** `nba_shot_chart_*.csv` + `nba_shot_chart_playoffs_*.csv` (50+ files)
- **Row count:** 5,715,079
- **Date range:** 1996-97 to 2024-25 (GAME_DATE range: 19961101–20250413)
- **Known issues:**
  - 547 rows with NULL LOC_X and LOC_Y (missing coordinate data for some historical shots)
  - Pre-2001 coverage is limited — shot chart data was not systematically tracked before the NBA API era
  - GAME_DATE stored as integer (YYYYMMDD), not ISO string — requires conversion for date arithmetic

---

### 6. `lineups`

5-man lineup combination stats (NBA API).

| Field | Type | Notes |
|---|---|---|
| GROUP_SET | TEXT | Always "Lineups" |
| GROUP_ID | TEXT | Player ID combination key |
| GROUP_NAME | TEXT | Player names in lineup |
| TEAM_ID | INTEGER | NBA team ID |
| TEAM_ABBREVIATION | TEXT | Team abbreviation |
| GP | INTEGER | Games played |
| W, L | INTEGER | Wins / Losses |
| W_PCT | REAL | Win percentage |
| MIN | REAL | Minutes together |
| FGM, FGA, FG_PCT | — | Field goals |
| FG3M, FG3A, FG3_PCT | — | Threes |
| FTM, FTA, FT_PCT | — | Free throws |
| OREB, DREB, REB | INTEGER | Rebounds |
| AST, TOV, STL, BLK | INTEGER | Assists/turnovers/steals/blocks |
| PTS | INTEGER | Points |
| PLUS_MINUS | INTEGER | Net rating |
| season | TEXT | Season string (e.g. "2024-25") |

- **Source CSVs:** `nba_lineups_5man_*.csv` (one per season)
- **Row count:** 24,000
- **Season coverage:** 2013-14 to 2024-25 (12 seasons)
- **Known gaps:**
  - **Seasons 2007-08 through 2012-13 are missing** — no lineup files found for those years
  - Note: agents referencing lineup instructions should be aware the `AGENTS.md` states coverage starts at 2018-25 but actual data starts 2013-14

---

### 7. `team_game_logs`

Team-level game records (NBA API).

| Field | Type | Notes |
|---|---|---|
| SEASON_ID | INTEGER | Season ID (e.g. 22007 = 2007-08) |
| TEAM_ID | INTEGER | NBA team ID |
| TEAM_ABBREVIATION | TEXT | Team abbreviation |
| TEAM_NAME | TEXT | Full team name |
| GAME_ID | INTEGER | Game ID |
| GAME_DATE | TEXT | Date (YYYY-MM-DD) |
| MATCHUP | TEXT | Matchup string |
| WL | TEXT | W or L |
| MIN | INTEGER | Minutes |
| FGM through PLUS_MINUS | — | Full box score stats |

- **Source CSVs:** `nba_team_gamelogs_*_regular.csv` (one per season)
- **Row count:** 43,158
- **Date range:** SEASON_ID 22007 to 22024 (2007-08 to 2024-25)
- **Known gaps:** Regular season only; no playoff game logs

---

### 8. `team_stats_advanced`

Team-level advanced metrics (NBA API).

| Field | Type | Notes |
|---|---|---|
| Season | TEXT | Season string |
| TEAM_ID | INTEGER | NBA team ID |
| TEAM_NAME | TEXT | Team name |
| GP, W, L | INTEGER | Games |
| W_PCT | REAL | Win % |
| MIN | INTEGER | Total minutes |
| OFF_RATING | REAL | Offensive rating |
| DEF_RATING | REAL | Defensive rating |
| NET_RATING | REAL | Net rating |
| AST_PCT, AST_TO, AST_RATIO | REAL | Assist metrics |
| OREB_PCT, DREB_PCT, REB_PCT | REAL | Rebound % |
| TM_TOV_PCT | REAL | Team turnover % |
| EFG_PCT, TS_PCT | REAL | Shooting efficiency |
| PACE | REAL | Pace |
| POSS | INTEGER | Possessions |
| PIE | REAL | Player Impact Estimate |

- **Source CSVs:** `nba_team_advanced_*.csv`
- **Row count:** 180
- **Season coverage:** 2017-18, 2018-19, 2019-20, 2021-22, 2022-23, 2024-25
- **Known gaps:**
  - **Seasons 2020-21, 2023-24 are missing** — no corresponding source CSVs found
  - Coverage is limited compared to other tables

---

### 9. `standings`

Conference and division standings.

| Field | Type | Notes |
|---|---|---|
| Season | TEXT | Season string (e.g. "2024-25") |
| Conference | TEXT | "East" or "West" |
| Rank | INTEGER | Conference rank |
| Team | TEXT | Team name |
| W, L | INTEGER | Wins / Losses |
| PCT | REAL | Win percentage |
| GB | TEXT | Games behind (text due to "-" for leader) |
| HOME, AWAY, DIV, CONF | TEXT | Split records |
| PPG, OPP_PPG, DIFF | REAL | Scoring averages |
| STRK | TEXT | Current streak |
| L10 | TEXT | Last 10 record |

- **Source CSVs:** `nba_standings_*.csv`
- **Row count:** 775
- **Date range:** Seasons 1999-00 to 2024-25
- **Known gaps:** Pre-1999 standings not available

---

### 10. `career_leaders`

All-time NBA career statistical leaderboards.

| Field | Type | Notes |
|---|---|---|
| Rank | REAL | Rank on leaderboard |
| Player | TEXT | Player name |
| HOF | TEXT | Hall of Fame flag |
| Active | TEXT | Currently active |
| Value | INTEGER | Career total or avg |
| stat | TEXT | Stat category |
| league | TEXT | NBA / ABA |

- **Source CSVs:** `career_leaders_*.csv` (one per stat)
- **Row count:** 6,704
- **Stat categories:** pts, ast, reb, stl, blk, fg3, ft, min, games
- **Date range:** All-time records (includes ABA era)

---

### 11. `awards`

Individual season awards (MVP, DPOY, ROY, SMOY, MIP, Finals MVP).

| Field | Type | Notes |
|---|---|---|
| Season | TEXT | Season string |
| Lg | TEXT | League (NBA/ABA) |
| Player | TEXT | Winner name |
| Voting | TEXT | Vote totals/breakdown |
| Age | TEXT | Age at award |
| Tm | TEXT | Team abbreviation |
| award_type | TEXT | Award category |

- **Source CSVs:** `awards_mvp_nba.csv`, `awards_dpoy_*.csv`, `awards_roy_*.csv`, `awards_smoy_*.csv`, `awards_mip_*.csv`, `awards_finals_mvp_*.csv`
- **Row count:** 351
- **Season coverage:** 1947-48 to 2024-25
- **Award types:** MVP, DPOY, ROY, SMOY, MIP, Finals MVP
- **Known gaps:**
  - Does not include All-Star, All-NBA, or All-Defensive team selections (those are in separate uningested CSVs: `all_nba_teams_history.csv`, `all_defense_teams_history.csv`)

---

### 12. `draft`

NBA/ABA draft pick history.

| Field | Type | Notes |
|---|---|---|
| Year | INTEGER | Draft year |
| Rk | TEXT | Overall rank |
| Pk | TEXT | Pick number |
| Tm | TEXT | Drafting team |
| Player | TEXT | Player name |
| College | TEXT | College |
| Yrs | TEXT | Years active |
| G | TEXT | Career games |
| MP_Total, PTS_Total, TRB_Total, AST_Total | TEXT | Career totals |
| FGPct, ThreePct, FTPct | TEXT | Career shooting % |
| MP_PG, PTS_PG, TRB_PG, AST_PG | TEXT | Career per-game |
| WS, WS48, BPM, VORP | TEXT | Advanced career stats |

- **Source CSV:** `bbref_draft_history_1996_2025.csv`
- **Row count:** 6,591
- **Date range:** Draft years 1966–2025
- **Known issues:**
  - 11 rows with NULL Player (likely empty picks or incomplete data)
  - Most numeric stats stored as TEXT — requires casting for queries

---

### 13. `tracking`

Player tracking data from NBA advanced stats (catch-and-shoot, drives, passing, pull-up shooting, speed/distance).

| Field | Type | Notes |
|---|---|---|
| Season | TEXT | Season string |
| PLAYER_ID | INTEGER | NBA player ID |
| PLAYER_NAME | TEXT | Player name |
| TEAM_ID | INTEGER | Team ID |
| TEAM_ABBREVIATION | TEXT | Team abbreviation |
| GP, W, L | INTEGER | Games |
| MIN | REAL | Minutes |
| measure_type | TEXT | Tracking category |
| CATCH_SHOOT_* | REAL | Catch-and-shoot stats |
| DRIVES, DRIVE_* | REAL | Drive stats |
| (various) | REAL | Type-specific fields |

- **Source CSVs:** `nba_tracking_*_20*.csv` (multiple measure types per season)
- **Row count:** 14,125
- **Season coverage:** 2020-21 to 2024-25 (5 seasons)
- **Measure types:** catch_shoot, drives, passing, pullup, speed_distance
- **Known gaps:**
  - Only covers seasons 2020-21 onward — earlier tracking data files exist in `~/Downloads/sportsdata/` but were not included in initial ingestion scope
  - 983 PLAYER_IDs have no match in `players` table (ID system mismatch)

---

## Data Quality Summary

| Table | Rows | NULL Issues | Duplicates | Referential Integrity |
|---|---|---|---|---|
| players | 5,407 | 10 null BirthDate | Name dupes (expected) | — |
| player_stats_pergame | 24,662 | 46 null PTS | TOT rows (expected) | — |
| player_stats_advanced | 24,662 | None detected | TOT rows (expected) | — |
| player_game_logs | 452,108 | None | None | 1,690 player IDs not in players |
| shots | 5,715,079 | 547 null LOC_X/Y | None | 0 missing player IDs |
| lineups | 24,000 | None | None | — |
| team_game_logs | 43,158 | None | None | — |
| team_stats_advanced | 180 | None | None | — |
| standings | 775 | None | None | — |
| career_leaders | 6,704 | None | None | — |
| awards | 351 | None | None | — |
| draft | 6,591 | 11 null Player | None | — |
| tracking | 14,125 | None | None | 983 player IDs not in players |

---

## Known Data Gaps

### Coverage Gaps by Table

| Gap | Details |
|---|---|
| Lineups pre-2013-14 | No lineup CSV files found for seasons before 2013-14 |
| Team stats advanced (2020-21, 2023-24) | Missing — no source CSVs found |
| Tracking pre-2020-21 | Coverage starts at 2020-21; earlier seasons not ingested |
| Shot chart pre-2001 | Limited tracking; shot coordinates unreliable before ~1997-98 |
| Player game logs pre-2007 | No game log CSVs for seasons before 2007-08 |
| Awards: All-Star / All-NBA / All-Defense | `all_nba_teams_history.csv` and `all_defense_teams_history.csv` exist in source but are not ingested |
| Team game logs playoffs | No playoff team game logs in database |

### ID System Mismatch

The `players` table uses rowid-based `player_id` values, not NBA API player IDs. Tables sourced from the NBA API (`player_game_logs`, `shots`, `tracking`, `lineups`) use official NBA API player IDs. **Do not join these tables directly on player ID** — use player name or build a crosswalk.

---

## Source CSV Inventory (`~/Downloads/sportsdata/`)

Total files: 433 CSVs (389 top-level, plus subdirectory files)

### Ingested (mapped to DB tables)

| CSV Pattern | DB Table |
|---|---|
| `all_player_bios.csv` | players |
| `player_pergame_*.csv` | player_stats_pergame |
| `player_advanced_*.csv` | player_stats_advanced |
| `nba_player_gamelogs_*.csv` | player_game_logs |
| `nba_shot_chart_*.csv` | shots |
| `nba_lineups_5man_*.csv` | lineups |
| `nba_team_gamelogs_*_regular.csv` | team_game_logs |
| `nba_team_advanced_*.csv` | team_stats_advanced |
| `nba_standings_*.csv` | standings |
| `career_leaders_*.csv` | career_leaders |
| `awards_*.csv` | awards |
| `bbref_draft_history_*.csv` | draft |
| `nba_tracking_*.csv` | tracking |

### Present but Not Ingested (potential future tables)

| CSV | Notes |
|---|---|
| `all_nba_teams_history.csv` | All-NBA team selections |
| `all_defense_teams_history.csv` | All-Defensive team selections |
| `bbref_player_per100poss_*.csv` | Per-100 possessions stats |
| `bbref_player_per36min_*.csv` | Per-36 minutes stats |
| `bbref_player_totals_*.csv` | Career/season totals |
| `bbref_player_shooting_*.csv` | Shot zone breakdowns (BBRef) |
| `bbref_team_advanced_*.csv` | Team advanced (BBRef source) |
| `bbref_team_pergame_*.csv` | Team per-game (BBRef) |
| `bbref_team_opponent_pergame_*.csv` | Opponent stats |
| `bbref_team_shooting_*.csv` | Team shooting zones |
| `bbref_game_results_*.csv` | Historical game results (pre-2007) |
| `nba_team_fourfactors_*.csv` | Four Factors data |
| `player_per100poss_*.csv` | Player per-100 (alternate) |
| `player_per36min_*.csv` | Player per-36 (alternate) |
| `player_totals_*.csv` | Season totals |
| `player_playoffs_pergame_*.csv` | Playoff per-game stats |
| `player_adj_shooting_*.csv` | Adjusted shooting % |
| `player_shooting_*.csv` | Shot zone breakdown |
| `team_season_stats_*.csv` | Team season stats |
| `nba_player_advanced_plusminus_*.csv` | Advanced +/- data |
| `nba_tracking_elbow_touch_*.csv` | Elbow touch tracking |
| `nba_tracking_paint_touch_*.csv` | Paint touch tracking |
| `nba_tracking_postup_*.csv` | Post-up tracking |
| `nba_tracking_rebounding_*.csv` | Rebounding tracking |
| `nba_shot_chart_playoffs_*.csv` | Playoff shot charts |
| `nba_player_playoffs_base_*.csv` | Playoff player stats |
| `bbref_playoffs_pergame_*.csv` | BBRef playoff stats |
| `bbref_player_contracts_2025_26.csv` | Contract data |
| `nba_team_stats_2025_26.csv` | Next-season team stats |

---

## Refresh History

| Date | Action | Notes |
|---|---|---|
| 2026-03-23 | Initial audit | First DATA_MANIFEST.md created. All 13 tables verified. |
