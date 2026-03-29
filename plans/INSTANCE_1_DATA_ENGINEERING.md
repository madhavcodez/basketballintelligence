# Instance 1: Data Engineering & Pipeline Hardening

**Duration:** 6 hours | **Owner:** All files under `scripts/`, `tests/` (project root), `DATA_MANIFEST.md`

## DO NOT TOUCH
- `src/` directory (owned by Instance 2)
- `video-ml/` directory (owned by Instance 3)
- `scripts/integration-test.sh` (owned by Instance 3)

---

## IMPORTANT: Scraper Still Running

A scraper is actively downloading more data to `~/Downloads/basketball_data/`. It is collecting:
- NBA API Phase 1-3 data (830 MB, 1921 files)
- BBRef yearly stats (362 files: pergame, advanced, per100, per36, totals, playoffs, shooting, drafts)
- Remaining BBRef data
- NBA API play-by-play (750 remaining games) + award voting data

**The scraper should finish within ~1 hour of your start time.** Before ingesting each data category:
1. Check if the expected CSV files exist yet (`ls ~/Downloads/basketball_data/bbref/` etc.)
2. If files are missing or still being written, **skip that table and come back to it later**
3. After hour 1, re-scan the data directory for any new files that appeared
4. At the end of your run, do a FINAL re-ingest pass to catch anything the scraper finished late

Also check `~/Downloads/basketball_data/` for any NEW data types beyond what's listed in this plan (e.g., play-by-play, award voting, hustle stats, clutch time). If you find new CSVs, ingest them too.

---

## Mission

Ingest ALL remaining CSV data from `~/Downloads/basketball_data/` into `data/basketball.db`, build a validation framework, build a regression snapshot system, and write comprehensive pytest tests. When done, basketball.db should have 31+ tables (13 existing + 18+ new) with full indexes and validation.

## Phase A: Infrastructure (0:00 - 0:30)

### A1: Create `scripts/models.py`
Pydantic models for each new table schema. Each model validates column types and constraints before insertion.

### A2: Create `scripts/pipeline_config.py`
Central configuration:
- `DATA_DIR = Path("C:/Users/madha/Downloads/basketball_data")`
- `BBREF_DIR = DATA_DIR / "bbref"`
- `DB_PATH = Path("data/basketball.db")`
- A `TableSpec` dataclass mapping table name -> glob pattern, schema model, header rename map, column filter, row filter function

### A3: Create `scripts/regression_snapshot.py` scaffold
The snapshot/compare system (fully implemented in Phase D).

## Phase B: Ingestion Functions (0:30 - 2:30)

Extend `src/scripts/ingest-basketball-data.py` with 18 new ingestion functions. Use `INSERT OR REPLACE` (already the pattern in the newer script). Each function:
1. Globs matching CSVs
2. Reads with fallback encodings
3. Applies header renames
4. Filters columns
5. Validates via Pydantic model (log failures, don't crash)
6. Batch inserts

### Tier 1: BBRef multi-season CSVs

**`ingest_player_stats_per100poss`**
- Glob: `bbref/per100_stats/bbref_player_per100poss_*.csv`
- Header renames: `{"Team": "Tm", "FG%": "FGPct", "3P%": "3PPct", "2P%": "2PPct", "FT%": "FTPct", "eFG%": "eFGPct"}`
- Row filter: Skip rows where Rk is non-numeric (repeated sub-headers)
- Season from filename

**`ingest_player_stats_per36min`**
- Glob: `bbref/per36_stats/bbref_player_per36min_*.csv`
- Same renames as per100. No ORtg/DRtg columns.

**`ingest_player_stats_totals`**
- Glob: `bbref/player_totals/bbref_player_totals_*.csv`
- Extra rename: `{"Trp-Dbl": "TrpDbl"}`
- Integer columns for counting stats (FG, FGA, PTS, etc.)

**`ingest_player_stats_playoffs_pergame`**
- Glob: `bbref/playoff_stats/player_playoffs_pergame_*.csv`
- Note: Column order differs from regular season (Pos before Age)

**`ingest_player_shooting_splits`** (COMPLEX - multi-level header)
- Glob: `bbref/shooting_stats/bbref_shooting_*.csv`
- CRITICAL: 2-row header. Skip both header rows. Map by positional index:
```
Index 0->Rk, 1->Player, 2->Age, 3->Tm, 4->Pos, 5->G, 6->GS, 7->MP,
8->FGPct, 9->AvgDist,
10->PctFGA_2P, 11->PctFGA_0_3, 12->PctFGA_3_10, 13->PctFGA_10_16, 14->PctFGA_16_3P, 15->PctFGA_3P,
16->FGPct_2P, 17->FGPct_0_3, 18->FGPct_3_10, 19->FGPct_10_16, 20->FGPct_16_3P, 21->FGPct_3P,
22->PctAstd_2P, 23->PctAstd_3P,
24->DunkPctFGA, 25->DunkCount,
26->Corner3PctOf3PA, 27->Corner3FGPct,
28->HalfCourtAtt, 29->HalfCourtMd,
30->Awards, 31->Season
```

### Tier 2: Enrichment single-file CSVs

| Function | Source | Notes |
|----------|--------|-------|
| `ingest_all_nba_teams` | `raw/bbref/all_nba_selections.csv` | Columns: season, league, team_number, player_name, position |
| `ingest_all_defense_teams` | `raw/bbref/all_defense_selections.csv` | Same schema as all_nba |
| `ingest_all_star_selections` | `processed/enrichments/all_star_selections_by_player.csv` | Columns: rank, player, all_star_selections |
| `ingest_awards_major` | `processed/enrichments/awards_major_1947_2025.csv` | Columns: season, player_name, team, award_type |
| `ingest_contracts` | `processed/enrichments/contracts_salaries.csv` | Columns: rank, name, position, team, salary, season |
| `ingest_draft_combine` | `processed/enrichments/draft_combine_measurements.csv` | Drop unnamed index column |
| `ingest_team_four_factors` | `processed/core/team_four_factors_regular_1997_2023.csv` | Drop all *_rank columns |
| `ingest_team_opponent_pergame` | `processed/core/team_opponent_regular_1997_2023.csv` | Drop all *_rank columns |
| `ingest_player_stats_defense` | `processed/enrichments/player_stats_defense_1997_2023.csv` | Drop nickname + rank columns |
| `ingest_player_stats_scoring` | `processed/enrichments/player_stats_scoring_1997_2023.csv` | Drop nickname + rank columns |
| `ingest_player_stats_usage` | `processed/enrichments/player_stats_usage_1997_2023.csv` | Drop nickname + rank + pct_blka/pf/pfd columns |

### Tier 3: Playoff + injury

| Function | Source | Notes |
|----------|--------|-------|
| `ingest_playoff_game_logs` | `processed/playoffs/player_game_logs_po_2010_2024.csv` | Drop teamslug/jerseynum columns |
| `ingest_injury_history` | `processed/enrichments/injury_history.csv` | Columns: date, team, acquired, relinquished, notes |

### Pipeline state tracking
Add `_pipeline_state` table to track per-table ingestion status:
```sql
CREATE TABLE IF NOT EXISTS _pipeline_state (
    table_name TEXT PRIMARY KEY,
    last_ingest_ts TEXT,
    row_count INTEGER,
    status TEXT,
    error_message TEXT
);
```

### CLI flags
- `--new-only` — Skip original 13 tables, only ingest new ones
- `--tables TABLE1,TABLE2` — Selectively ingest specific tables
- `--dry-run` — Validate schemas without writing to DB
- `--resume` — Skip tables already successfully ingested in last 24h

## Phase C: Validation Framework (2:30 - 3:15)

Create `scripts/validate.py` with:
- `TableValidator` class: check_row_count, check_no_nulls, check_null_ratio, check_unique, check_referential, check_value_range, check_season_format
- Per-table validation rules (see below)
- Summary pass/fail report

### Validation rules per table

| Table | Min Rows | Not-Null | Range Checks |
|-------|----------|----------|-------------|
| player_stats_per100poss | 20,000 | Player, Season | PTS 0-80, G 1-90 |
| player_stats_per36min | 20,000 | Player, Season | PTS 0-60 |
| player_stats_totals | 20,000 | Player, Season | G 1-90, PTS 0-4000 |
| player_stats_playoffs_pergame | 8,000 | Player, Season | G 1-30 |
| player_shooting_splits | 8,000 | Player, Season | FGPct 0.0-1.0 |
| all_nba_teams | 5 | player_name, season | -- |
| all_defense_teams | 5 | player_name, season | -- |
| contracts | 5,000 | name, salary | salary > 0 |
| draft_combine | 300 | player, year | year 2000-2026 |
| team_four_factors | 700 | team_name, season | efg_pct 0.3-0.7 |
| team_opponent_pergame | 700 | team_name, season | opp_fg_pct 0.3-0.6 |
| player_stats_defense | 10,000 | player_name, season | def_rating 80-130 |
| player_stats_usage | 10,000 | player_name, season | usg_pct 0-0.5 |
| playoff_game_logs | 25,000 | personname | pts 0-70 |
| injury_history | 20,000 | date, team | -- |

## Phase D: Regression Snapshot System (3:15 - 4:00)

Create `scripts/regression_snapshot.py` with 20 sentinel queries:
```python
SENTINEL_QUERIES = {
    "total_players": "SELECT COUNT(*) FROM players",
    "total_pergame_rows": "SELECT COUNT(*) FROM player_stats_pergame",
    "total_shots": "SELECT COUNT(*) FROM shots",
    "lebron_career_seasons": "SELECT COUNT(*) FROM player_stats_pergame WHERE Player = 'LeBron James'",
    "lebron_career_pts_avg": "SELECT ROUND(AVG(CAST(PTS AS REAL)), 1) FROM player_stats_pergame WHERE Player = 'LeBron James'",
    "curry_3pt_seasons": "SELECT COUNT(*) FROM player_stats_pergame WHERE Player = 'Stephen Curry' AND CAST(\"3P\" AS REAL) > 3.0",
    "top_scorer_2024": "SELECT Player FROM player_stats_pergame WHERE Season LIKE '%2024%' ORDER BY CAST(PTS AS REAL) DESC LIMIT 1",
    # ... plus queries for all new tables
}
```

Usage: `python scripts/regression_snapshot.py snapshot` / `python scripts/regression_snapshot.py compare`

Snapshots stored as JSON in `data/snapshots/snapshot_YYYYMMDD_HHMMSS.json`.

## Phase E: Test Suite (4:00 - 5:00)

Create `tests/` directory with:
- `tests/conftest.py` — fixtures: tmp_db, sample_csv_dir, populated_db
- `tests/test_ingest.py` — Tests per ingestion function (idempotency, header renames, crash resilience, subheader filtering)
- `tests/test_validate.py` — Tests for validation rules (row counts, nulls, ranges, referential)
- `tests/test_regression.py` — Tests for snapshot creation and comparison
- `tests/test_schemas.py` — Pydantic model validation tests

Target: 30+ test functions, 80%+ coverage on ingestion code.

## Phase F: Wire Together (5:00 - 5:30)

Create `scripts/run_pipeline.py` orchestrator:
1. Take regression snapshot (before)
2. Run ingestion (all or --new-only)
3. Run add_indexes.py
4. Run validate.py
5. Take regression snapshot (after)
6. Run comparison
7. Write summary report to `data/pipeline_report_YYYYMMDD.txt`
8. Exit 0 on success, 1 on critical failures

Update:
- `scripts/add_indexes.py` — Add ~40 new indexes for new tables
- `scripts/verify_db.py` — Expand expected_tables to 31
- `DATA_MANIFEST.md` — Document all 18 new table schemas

## Phase G: End-to-End Verification (5:30 - 6:00)

1. Run `python scripts/run_pipeline.py`
2. Run `pytest tests/ -v --cov`
3. Verify basketball.db has 31 tables
4. Verify no regression in existing table row counts
5. Fix any failures and re-run
