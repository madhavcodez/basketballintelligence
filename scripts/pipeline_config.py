#!/usr/bin/env python3
"""
Pipeline configuration — path constants, table specs, and column mappings
for all 18 new ingestion tables.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


# ── Defaults ─────────────────────────────────────────────────────────────────

DEFAULT_DATA_DIR = Path(r"C:\Users\madha\Downloads\basketball_data")
DEFAULT_DB_PATH = Path(
    r"C:\Users\madha\OneDrive\Desktop\basketballintelligence\data\basketball.db"
)


# ── Table Spec ───────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class TableSpec:
    """Immutable specification for a single ingestion table."""
    name: str
    tier: int  # 1, 2, or 3
    source_type: str  # "multi_season_glob" or "single_file"
    source_pattern: str  # glob pattern or single file path (relative to data_dir)
    columns: tuple[str, ...]
    season_from_filename: bool = False  # whether to extract season from filename
    has_multi_header: bool = False  # shooting splits have 2-row header
    min_expected_rows: int = 0
    description: str = ""


# ── Tier 1: BBRef multi-season CSVs ─────────────────────────────────────────

BBREF_STANDARD_COLUMNS = (
    "Rk", "Player", "Age", "Team", "Pos", "G", "GS", "MP",
    "FG", "FGA", "FG_pct", "3P", "3PA", "3P_pct",
    "2P", "2PA", "2P_pct", "eFG_pct",
    "FT", "FTA", "FT_pct",
    "ORB", "DRB", "TRB", "AST", "STL", "BLK", "TOV", "PF", "PTS",
)

PLAYER_STATS_PER100POSS = TableSpec(
    name="player_stats_per100poss",
    tier=1,
    source_type="multi_season_glob",
    source_pattern="bbref/per100_stats/bbref_player_per100poss_*.csv",
    columns=BBREF_STANDARD_COLUMNS + ("ORtg", "DRtg", "Awards", "Season"),
    season_from_filename=True,
    min_expected_rows=20000,
    description="Per-100 possessions stats from BBRef (1980-2025)",
)

PLAYER_STATS_PER36MIN = TableSpec(
    name="player_stats_per36min",
    tier=1,
    source_type="multi_season_glob",
    source_pattern="bbref/per36_stats/bbref_player_per36min_*.csv",
    columns=BBREF_STANDARD_COLUMNS + ("Awards", "Season"),
    season_from_filename=True,
    min_expected_rows=20000,
    description="Per-36 minutes stats from BBRef (1980-2025)",
)

PLAYER_STATS_TOTALS = TableSpec(
    name="player_stats_totals",
    tier=1,
    source_type="multi_season_glob",
    source_pattern="bbref/player_totals/bbref_player_totals_*.csv",
    columns=BBREF_STANDARD_COLUMNS + ("Trp-Dbl", "Awards", "Season"),
    season_from_filename=True,
    min_expected_rows=20000,
    description="Season totals from BBRef (1980-2025)",
)

PLAYER_STATS_PLAYOFFS_PERGAME = TableSpec(
    name="player_stats_playoffs_pergame_bbref",
    tier=1,
    source_type="multi_season_glob",
    source_pattern="bbref/playoff_stats/player_playoffs_pergame_*.csv",
    columns=(
        "Rk", "Player", "Pos", "Age", "Tm", "G", "GS", "MP",
        "FG", "FGA", "FG_pct", "3P", "3PA", "3P_pct",
        "2P", "2PA", "2P_pct", "eFG_pct",
        "FT", "FTA", "FT_pct",
        "ORB", "DRB", "TRB", "AST", "STL", "BLK", "TOV", "PF", "PTS",
        "Season",
    ),
    season_from_filename=True,
    min_expected_rows=10000,
    description="Playoff per-game stats from BBRef (1980-2025)",
)

# Shooting splits: 2-row multi-level header, 32 positional columns
PLAYER_SHOOTING_SPLITS = TableSpec(
    name="player_shooting_splits",
    tier=1,
    source_type="multi_season_glob",
    source_pattern="bbref/shooting_stats/bbref_shooting_*.csv",
    columns=(
        "Rk", "Player", "Age", "Team", "Pos", "G", "GS", "MP",
        "FG_pct", "Avg_Dist",
        "pct_FGA_2P", "pct_FGA_0_3", "pct_FGA_3_10", "pct_FGA_10_16",
        "pct_FGA_16_3P", "pct_FGA_3P",
        "FG_pct_2P", "FG_pct_0_3", "FG_pct_3_10", "FG_pct_10_16",
        "FG_pct_16_3P", "FG_pct_3P",
        "pct_Astd_2P", "pct_Astd_3P",
        "pct_FGA_Dunk", "Dunk_Made",
        "pct_3PA_Corner", "Corner_3_pct",
        "Heave_Att", "Heave_Made",
        "Awards", "Season",
    ),
    season_from_filename=True,
    has_multi_header=True,
    min_expected_rows=8000,
    description="Shooting splits from BBRef (2000-2025). 2-row multi-level header.",
)


# ── Tier 2: Enrichment single-file CSVs ─────────────────────────────────────

ALL_NBA_TEAMS = TableSpec(
    name="all_nba_teams",
    tier=2,
    source_type="single_file",
    source_pattern="raw/bbref/all_nba_selections.csv",
    columns=("season", "league", "team_number", "player_name", "position"),
    min_expected_rows=20,
    description="All-NBA team selections by season",
)

ALL_DEFENSE_TEAMS = TableSpec(
    name="all_defense_teams",
    tier=2,
    source_type="single_file",
    source_pattern="raw/bbref/all_defense_selections.csv",
    columns=("season", "league", "team_number", "player_name", "position"),
    min_expected_rows=5,
    description="All-Defensive team selections by season",
)

ALL_STAR_SELECTIONS = TableSpec(
    name="all_star_selections_new",
    tier=2,
    source_type="single_file",
    source_pattern="processed/enrichments/all_star_selections_by_player.csv",
    columns=("rank", "player", "all_star_selections"),
    min_expected_rows=40,
    description="All-Star selection counts by player",
)

AWARDS_MAJOR = TableSpec(
    name="awards_major",
    tier=2,
    source_type="single_file",
    source_pattern="processed/enrichments/awards_major_1947_2025.csv",
    columns=("season", "player_name", "team", "award_type"),
    min_expected_rows=150,
    description="Major award winners 1947-2025 (MVP, DPOY, ROY, etc.)",
)

CONTRACTS = TableSpec(
    name="contracts",
    tier=2,
    source_type="single_file",
    source_pattern="processed/enrichments/contracts_salaries.csv",
    columns=("rank", "name", "position", "team", "salary", "season"),
    min_expected_rows=5000,
    description="Player contracts and salaries",
)

DRAFT_COMBINE = TableSpec(
    name="draft_combine",
    tier=2,
    source_type="single_file",
    source_pattern="processed/enrichments/draft_combine_measurements.csv",
    columns=(
        "idx", "player", "year", "draft_pick",
        "height_no_shoes", "height_with_shoes", "wingspan", "standing_reach",
        "vertical_max", "vertical_max_reach", "vertical_no_step",
        "vertical_no_step_reach", "weight", "body_fat",
        "hand_length", "hand_width", "bench", "agility", "sprint",
    ),
    min_expected_rows=400,
    description="NBA Draft Combine measurements",
)

TEAM_FOUR_FACTORS = TableSpec(
    name="team_four_factors",
    tier=2,
    source_type="single_file",
    source_pattern="processed/core/team_four_factors_regular_1997_2023.csv",
    columns=(
        "team_id", "team_name", "gp", "w", "l", "w_pct", "min",
        "efg_pct", "fta_rate", "tm_tov_pct", "oreb_pct",
        "opp_efg_pct", "opp_fta_rate", "opp_tov_pct", "opp_oreb_pct",
        # rank columns follow but we ingest all
    ),
    min_expected_rows=700,
    description="Team Four Factors (regular season 1997-2023)",
)

TEAM_OPPONENT_PERGAME = TableSpec(
    name="team_opponent_pergame",
    tier=2,
    source_type="single_file",
    source_pattern="processed/core/team_opponent_regular_1997_2023.csv",
    columns=(
        "team_id", "team_name", "gp", "w", "l", "w_pct", "min",
        "opp_fgm", "opp_fga", "opp_fg_pct", "opp_fg3m", "opp_fg3a",
        "opp_fg3_pct", "opp_ftm", "opp_fta", "opp_ft_pct",
        "opp_oreb", "opp_dreb", "opp_reb", "opp_ast", "opp_tov",
        "opp_stl", "opp_blk", "opp_blka", "opp_pf", "opp_pfd",
        "opp_pts", "plus_minus",
    ),
    min_expected_rows=700,
    description="Team opponent per-game stats (regular season 1997-2023)",
)

PLAYER_STATS_DEFENSE = TableSpec(
    name="player_stats_defense_new",
    tier=2,
    source_type="single_file",
    source_pattern="processed/enrichments/player_stats_defense_1997_2023.csv",
    columns=(
        "player_id", "player_name", "nickname", "team_id",
        "team_abbreviation", "age", "gp", "w", "l", "w_pct", "min",
        "def_rating", "dreb", "dreb_pct", "pct_dreb",
        "stl", "pct_stl", "blk", "pct_blk",
        "opp_pts_off_tov", "opp_pts_2nd_chance", "opp_pts_fb",
        "opp_pts_paint", "def_ws",
    ),
    min_expected_rows=10000,
    description="Player defensive stats (1997-2023)",
)

PLAYER_STATS_SCORING = TableSpec(
    name="player_stats_scoring_new",
    tier=2,
    source_type="single_file",
    source_pattern="processed/enrichments/player_stats_scoring_1997_2023.csv",
    columns=(
        "player_id", "player_name", "nickname", "team_id",
        "team_abbreviation", "age", "gp", "w", "l", "w_pct", "min",
        "pts_off_tov", "pts_2nd_chance", "pts_fb", "pts_paint",
        "opp_pts_off_tov", "opp_pts_2nd_chance", "opp_pts_fb",
        "opp_pts_paint", "blk", "blka", "pf", "pfd", "nba_fantasy_pts",
    ),
    min_expected_rows=10000,
    description="Player scoring stats (1997-2023)",
)

PLAYER_STATS_USAGE = TableSpec(
    name="player_stats_usage_new",
    tier=2,
    source_type="single_file",
    source_pattern="processed/enrichments/player_stats_usage_1997_2023.csv",
    columns=(
        "player_id", "player_name", "nickname", "team_id",
        "team_abbreviation", "age", "gp", "w", "l", "w_pct", "min",
        "usg_pct", "pct_fgm", "pct_fga", "pct_fg3m", "pct_fg3a",
        "pct_ftm", "pct_fta", "pct_oreb", "pct_dreb", "pct_reb",
        "pct_ast", "pct_tov", "pct_stl", "pct_blk", "pct_blka",
        "pct_pf", "pct_pfd", "pct_pts",
    ),
    min_expected_rows=10000,
    description="Player usage stats (1997-2023)",
)


# ── Tier 3: Playoff extended ────────────────────────────────────────────────

PLAYOFF_GAME_LOGS = TableSpec(
    name="playoff_game_logs",
    tier=3,
    source_type="single_file",
    source_pattern="processed/playoffs/player_game_logs_po_2010_2024.csv",
    columns=(
        "season_year", "game_date", "gameid", "teamid", "teamcity",
        "teamname", "teamtricode", "teamslug", "personid", "personname",
        "position", "comment", "jerseynum", "minutes",
        "fieldgoalsmade", "fieldgoalsattempted", "fieldgoalspercentage",
        "threepointersmade", "threepointersattempted",
        "threepointerspercentage",
        "freethrowsmade", "freethrowsattempted", "freethrowspercentage",
        "reboundsoffensive", "reboundsdefensive", "reboundstotal",
        "assists", "steals", "blocks", "turnovers", "foulspersonal",
        "points", "plusminuspoints",
    ),
    min_expected_rows=25000,
    description="Playoff individual game logs (2010-2024)",
)

INJURY_HISTORY = TableSpec(
    name="injury_history",
    tier=3,
    source_type="single_file",
    source_pattern="processed/enrichments/injury_history.csv",
    columns=("date", "team", "acquired", "relinquished", "notes"),
    min_expected_rows=20000,
    description="Injury transaction history",
)


# ── Registry ─────────────────────────────────────────────────────────────────

ALL_NEW_TABLES: tuple[TableSpec, ...] = (
    # Tier 1
    PLAYER_STATS_PER100POSS,
    PLAYER_STATS_PER36MIN,
    PLAYER_STATS_TOTALS,
    PLAYER_STATS_PLAYOFFS_PERGAME,
    PLAYER_SHOOTING_SPLITS,
    # Tier 2
    ALL_NBA_TEAMS,
    ALL_DEFENSE_TEAMS,
    ALL_STAR_SELECTIONS,
    AWARDS_MAJOR,
    CONTRACTS,
    DRAFT_COMBINE,
    TEAM_FOUR_FACTORS,
    TEAM_OPPONENT_PERGAME,
    PLAYER_STATS_DEFENSE,
    PLAYER_STATS_SCORING,
    PLAYER_STATS_USAGE,
    # Tier 3
    PLAYOFF_GAME_LOGS,
    INJURY_HISTORY,
)

# Lookup by name
TABLE_REGISTRY: dict[str, TableSpec] = {t.name: t for t in ALL_NEW_TABLES}

# Existing 13 tables (from the original pipeline)
EXISTING_TABLES: tuple[str, ...] = (
    "players",
    "player_stats_pergame",
    "player_stats_advanced",
    "shots",
    "player_game_logs",
    "team_game_logs",
    "lineups",
    "awards",
    "draft",
    "standings",
    "team_stats_advanced",
    "tracking",
    "career_leaders",
)

# All tables after full ingestion
ALL_TABLE_NAMES: tuple[str, ...] = EXISTING_TABLES + tuple(
    t.name for t in ALL_NEW_TABLES
)
