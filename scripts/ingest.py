#!/usr/bin/env python3
"""
Basketball Intelligence Playground - Data Ingestion Pipeline

Reads CSV files from ~/Downloads/sportsdata/ and creates a SQLite database
at basketball-intelligence/data/basketball.db with properly typed and indexed tables.
"""

import glob
import os
import re
import sqlite3
import sys
import traceback
from pathlib import Path

import pandas as pd

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SOURCE_DIR = os.path.expanduser("~/Downloads/sportsdata")
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PROJECT_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "basketball.db")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_duplicate(filename: str) -> bool:
    """Return True for filenames that contain (1), (2), etc. -- duplicate downloads."""
    return bool(re.search(r"\(\d+\)", filename))


def _source(name: str) -> str:
    """Return absolute path for a file inside SOURCE_DIR."""
    return os.path.join(SOURCE_DIR, name)


def _source_glob(pattern: str) -> list[str]:
    """
    Glob inside SOURCE_DIR, excluding duplicate files and returning sorted results.
    """
    matches = glob.glob(os.path.join(SOURCE_DIR, pattern))
    return sorted(f for f in matches if not _is_duplicate(os.path.basename(f)))


def _season_from_filename(filename: str) -> str:
    """
    Extract a season string like '2023-24' from a filename containing '2023_24'.
    Falls back to returning any 4-digit year found.
    """
    m = re.search(r"(\d{4})_(\d{2})", filename)
    if m:
        return f"{m.group(1)}-{m.group(2)}"
    m = re.search(r"(\d{4})", filename)
    if m:
        return m.group(1)
    return "unknown"


def _create_index(conn: sqlite3.Connection, table: str, columns: list[str]) -> None:
    """Create a non-unique index on *columns* for *table* if it doesn't exist."""
    idx_name = f"idx_{table}_{'_'.join(c.lower() for c in columns)}"
    col_list = ", ".join(f'"{c}"' for c in columns)
    conn.execute(f'CREATE INDEX IF NOT EXISTS "{idx_name}" ON "{table}" ({col_list})')


def _safe_read_csv(path: str, **kwargs) -> pd.DataFrame:
    """Read a CSV with common safety settings."""
    defaults = dict(
        encoding="utf-8",
        on_bad_lines="skip",
        low_memory=False,
    )
    defaults.update(kwargs)
    try:
        return pd.read_csv(path, **defaults)
    except UnicodeDecodeError:
        defaults["encoding"] = "latin-1"
        return pd.read_csv(path, **defaults)


# ---------------------------------------------------------------------------
# Table ingestion functions
# ---------------------------------------------------------------------------

def ingest_players(conn: sqlite3.Connection) -> None:
    """(a) players -- from all_player_bios.csv"""
    print("[1/13] Ingesting players ...")
    path = _source("all_player_bios.csv")
    df = _safe_read_csv(path)
    # player_id is autoincrement -- let SQLite handle it
    df.to_sql("players", conn, if_exists="replace", index=False)
    # Add player_id as autoincrement primary key via a rebuild
    conn.execute("ALTER TABLE players ADD COLUMN player_id INTEGER")
    conn.execute("UPDATE players SET player_id = rowid")
    _create_index(conn, "players", ["Player"])
    row_count = conn.execute("SELECT COUNT(*) FROM players").fetchone()[0]
    print(f"         -> {row_count} rows")


def ingest_player_stats_pergame(conn: sqlite3.Connection) -> None:
    """(b) player_stats_pergame -- from all_player_pergame_stats_1980_2025.csv

    The CSV header says ``Season,Player,Pos,Age,Tm`` but data order is
    ``Season,Player,Age,Tm,Pos``.  We supply correct column names.
    """
    print("[2/13] Ingesting player_stats_pergame ...")
    path = _source("all_player_pergame_stats_1980_2025.csv")

    correct_columns = [
        "Season", "Player", "Age", "Tm", "Pos",
        "G", "GS", "MP", "FG", "FGA", "FGPct",
        "3P", "3PA", "3PPct", "2P", "2PA", "2PPct", "eFGPct",
        "FT", "FTA", "FTPct",
        "ORB", "DRB", "TRB", "AST", "STL", "BLK", "TOV", "PF", "PTS",
        "Awards",
    ]
    df = _safe_read_csv(path, header=None, skiprows=[0], names=correct_columns)
    df.to_sql("player_stats_pergame", conn, if_exists="replace", index=False)
    _create_index(conn, "player_stats_pergame", ["Player"])
    _create_index(conn, "player_stats_pergame", ["Season"])
    _create_index(conn, "player_stats_pergame", ["Tm"])
    row_count = conn.execute("SELECT COUNT(*) FROM player_stats_pergame").fetchone()[0]
    print(f"         -> {row_count} rows")


def ingest_player_stats_advanced(conn: sqlite3.Connection) -> None:
    """(c) player_stats_advanced -- merge 1980-2005, 2006-2015, and 2016-2025 files.

    These CSVs have a misaligned header: 30 header columns but only 29 data columns.
    The header says ``Pos,Age,Tm`` but data order is ``Age,Tm,Pos``, the header
    lists two blank columns but data has none, and an unlisted ``GS`` column is present.
    We skip the original header and supply correct column names.
    """
    print("[3/13] Ingesting player_stats_advanced ...")

    # The primary 2016-2025 file is header-only (0 data rows).
    # The real data is in the "(1)" duplicate.  Use it as a fallback.
    files = [
        _source("player_advanced_1980_2005.csv"),
        _source("player_advanced_2006_2015.csv"),
    ]
    f2016 = _source("player_advanced_2016_2025.csv")
    f2016_dup = os.path.join(SOURCE_DIR, "player_advanced_2016_2025 (1).csv")
    if os.path.exists(f2016_dup):
        files.append(f2016_dup)
    elif os.path.exists(f2016):
        files.append(f2016)

    # Correct column names matching the 29 data fields.
    correct_columns = [
        "Season", "Player", "Age", "Tm", "Pos",
        "G", "GS", "MP",
        "PER", "TSPct", "3PAr", "FTr",
        "ORBPct", "DRBPct", "TRBPct", "ASTPct", "STLPct", "BLKPct",
        "TOVPct", "USGPct",
        "OWS", "DWS", "WS", "WS48",
        "OBPM", "DBPM", "BPM", "VORP", "Awards",
    ]

    frames = []
    for path in files:
        if not os.path.exists(path):
            print(f"         [WARN] File not found, skipping: {path}")
            continue
        try:
            df = _safe_read_csv(path, header=None, skiprows=[0], names=correct_columns)
            # Drop rows where Season is not numeric (e.g. repeated sub-headers)
            df = df[pd.to_numeric(df["Season"], errors="coerce").notna()]
            frames.append(df)
            print(f"         {os.path.basename(path)}: {len(df)} rows")
        except Exception as exc:
            print(f"         [ERROR] {os.path.basename(path)}: {exc}")

    if not frames:
        print("         [WARN] No advanced stats data found.")
        return

    df = pd.concat(frames, ignore_index=True)

    df.to_sql("player_stats_advanced", conn, if_exists="replace", index=False)
    _create_index(conn, "player_stats_advanced", ["Player"])
    _create_index(conn, "player_stats_advanced", ["Season"])
    _create_index(conn, "player_stats_advanced", ["Tm"])
    row_count = conn.execute("SELECT COUNT(*) FROM player_stats_advanced").fetchone()[0]
    print(f"         -> {row_count} rows")


def ingest_shots(conn: sqlite3.Connection) -> None:
    """(d) shots -- from all nba_shotchart_*_regular.csv files."""
    print("[4/13] Ingesting shots (this may take a while) ...")
    files = _source_glob("nba_shotchart_*_regular.csv")
    total_rows = 0
    for i, path in enumerate(files):
        fname = os.path.basename(path)
        season = _season_from_filename(fname)
        try:
            df = _safe_read_csv(path)
            # Drop GRID_TYPE column if present (not in spec)
            df = df.drop(columns=["GRID_TYPE"], errors="ignore")
            df["season"] = season
            mode = "replace" if i == 0 else "append"
            df.to_sql("shots", conn, if_exists=mode, index=False)
            total_rows += len(df)
            print(f"         [{i+1}/{len(files)}] {fname}: {len(df)} rows (season={season})")
        except Exception as exc:
            print(f"         [ERROR] {fname}: {exc}")

    _create_index(conn, "shots", ["PLAYER_NAME"])
    _create_index(conn, "shots", ["TEAM_NAME"])
    _create_index(conn, "shots", ["season"])
    _create_index(conn, "shots", ["PLAYER_ID"])
    print(f"         -> {total_rows} total rows")


def ingest_player_game_logs(conn: sqlite3.Connection) -> None:
    """(e) player_game_logs -- from all nba_player_gamelogs_*_regular.csv files."""
    print("[5/13] Ingesting player_game_logs ...")
    files = _source_glob("nba_player_gamelogs_*_regular.csv")
    total_rows = 0

    # Columns to keep (drop VIDEO_AVAILABLE)
    keep_cols = [
        "SEASON_ID", "PLAYER_ID", "PLAYER_NAME", "TEAM_ID", "TEAM_ABBREVIATION",
        "TEAM_NAME", "GAME_ID", "GAME_DATE", "MATCHUP", "WL", "MIN", "FGM", "FGA",
        "FG_PCT", "FG3M", "FG3A", "FG3_PCT", "FTM", "FTA", "FT_PCT", "OREB", "DREB",
        "REB", "AST", "STL", "BLK", "TOV", "PF", "PTS", "PLUS_MINUS", "FANTASY_PTS",
    ]

    for i, path in enumerate(files):
        fname = os.path.basename(path)
        try:
            df = _safe_read_csv(path)
            # Keep only columns that exist in both spec and file
            available = [c for c in keep_cols if c in df.columns]
            df = df[available]
            mode = "replace" if i == 0 else "append"
            df.to_sql("player_game_logs", conn, if_exists=mode, index=False)
            total_rows += len(df)
        except Exception as exc:
            print(f"         [ERROR] {fname}: {exc}")

    _create_index(conn, "player_game_logs", ["PLAYER_NAME"])
    _create_index(conn, "player_game_logs", ["PLAYER_ID"])
    _create_index(conn, "player_game_logs", ["TEAM_ABBREVIATION"])
    print(f"         -> {total_rows} rows")


def ingest_team_game_logs(conn: sqlite3.Connection) -> None:
    """(f) team_game_logs -- from all nba_team_gamelogs_*_regular.csv files."""
    print("[6/13] Ingesting team_game_logs ...")
    files = _source_glob("nba_team_gamelogs_*_regular.csv")
    total_rows = 0

    keep_cols = [
        "SEASON_ID", "TEAM_ID", "TEAM_ABBREVIATION", "TEAM_NAME", "GAME_ID",
        "GAME_DATE", "MATCHUP", "WL", "MIN", "FGM", "FGA", "FG_PCT", "FG3M",
        "FG3A", "FG3_PCT", "FTM", "FTA", "FT_PCT", "OREB", "DREB", "REB",
        "AST", "STL", "BLK", "TOV", "PF", "PTS", "PLUS_MINUS",
    ]

    for i, path in enumerate(files):
        fname = os.path.basename(path)
        try:
            df = _safe_read_csv(path)
            available = [c for c in keep_cols if c in df.columns]
            df = df[available]
            mode = "replace" if i == 0 else "append"
            df.to_sql("team_game_logs", conn, if_exists=mode, index=False)
            total_rows += len(df)
        except Exception as exc:
            print(f"         [ERROR] {fname}: {exc}")

    _create_index(conn, "team_game_logs", ["TEAM_ABBREVIATION"])
    _create_index(conn, "team_game_logs", ["SEASON_ID"])
    print(f"         -> {total_rows} rows")


def ingest_lineups(conn: sqlite3.Connection) -> None:
    """(g) lineups -- from all nba_lineups_5man_*.csv files."""
    print("[7/13] Ingesting lineups ...")
    files = _source_glob("nba_lineups_5man_*.csv")
    total_rows = 0

    keep_cols = [
        "GROUP_SET", "GROUP_ID", "GROUP_NAME", "TEAM_ID", "TEAM_ABBREVIATION",
        "GP", "W", "L", "W_PCT", "MIN", "FGM", "FGA", "FG_PCT", "FG3M", "FG3A",
        "FG3_PCT", "FTM", "FTA", "FT_PCT", "OREB", "DREB", "REB", "AST", "TOV",
        "STL", "BLK", "PTS", "PLUS_MINUS",
    ]

    for i, path in enumerate(files):
        fname = os.path.basename(path)
        season = _season_from_filename(fname)
        try:
            df = _safe_read_csv(path)
            available = [c for c in keep_cols if c in df.columns]
            df = df[available]
            df["season"] = season
            mode = "replace" if i == 0 else "append"
            df.to_sql("lineups", conn, if_exists=mode, index=False)
            total_rows += len(df)
        except Exception as exc:
            print(f"         [ERROR] {fname}: {exc}")

    _create_index(conn, "lineups", ["TEAM_ABBREVIATION"])
    _create_index(conn, "lineups", ["season"])
    print(f"         -> {total_rows} rows")


def ingest_awards(conn: sqlite3.Connection) -> None:
    """(h) awards -- from multiple awards_*.csv files with 2-row headers."""
    print("[8/13] Ingesting awards ...")

    award_files = {
        "MVP": "awards_mvp_nba.csv",
        "DPOY": "awards_dpoy_dpoy_NBA.csv",
        "Finals MVP": "awards_finals_mvp_finals_mvp_NBA.csv",
        "MIP": "awards_mip_mip_NBA.csv",
        "ROY": "awards_roy_roy_NBA.csv",
        "SMOY": "awards_smoy_smoy_NBA.csv",
    }

    total_rows = 0
    first = True

    for award_type, filename in award_files.items():
        path = _source(filename)
        if not os.path.exists(path):
            print(f"         [WARN] Not found: {filename}")
            continue
        try:
            # Row 0 is a category header, row 1 is the real header
            df = _safe_read_csv(path, skiprows=[0])

            # Normalize columns: keep only the ones we care about
            # The files vary -- some have Voting, some don't
            desired = ["Season", "Lg", "Player", "Voting", "Age", "Tm"]
            available = [c for c in desired if c in df.columns]
            df = df[available]
            df["award_type"] = award_type

            mode = "replace" if first else "append"
            df.to_sql("awards", conn, if_exists=mode, index=False)
            total_rows += len(df)
            first = False
            print(f"         {award_type}: {len(df)} rows")
        except Exception as exc:
            print(f"         [ERROR] {filename}: {exc}")

    _create_index(conn, "awards", ["Player"])
    _create_index(conn, "awards", ["Season"])
    print(f"         -> {total_rows} total rows")


def ingest_draft(conn: sqlite3.Connection) -> None:
    """(i) draft -- from nba_draft_history_1966_2025.csv (has a 2-row header)."""
    print("[9/13] Ingesting draft ...")
    path = _source("nba_draft_history_1966_2025.csv")

    # Row 0 is the real header, row 1 is a repeat / sub-header -- skip it
    df = _safe_read_csv(path, skiprows=[1])

    df.to_sql("draft", conn, if_exists="replace", index=False)
    _create_index(conn, "draft", ["Player"])
    _create_index(conn, "draft", ["Year"])
    row_count = conn.execute("SELECT COUNT(*) FROM draft").fetchone()[0]
    print(f"         -> {row_count} rows")


def ingest_standings(conn: sqlite3.Connection) -> None:
    """(j) standings -- from nba_standings_history_2000_2025.csv."""
    print("[10/13] Ingesting standings ...")
    path = _source("nba_standings_history_2000_2025.csv")
    df = _safe_read_csv(path)
    df.to_sql("standings", conn, if_exists="replace", index=False)
    _create_index(conn, "standings", ["Team"])
    _create_index(conn, "standings", ["Season"])
    row_count = conn.execute("SELECT COUNT(*) FROM standings").fetchone()[0]
    print(f"         -> {row_count} rows")


def ingest_team_stats_advanced(conn: sqlite3.Connection) -> None:
    """(k) team_stats_advanced -- from nba_team_advanced_2017_2025.csv."""
    print("[11/13] Ingesting team_stats_advanced ...")
    path = _source("nba_team_advanced_2017_2025.csv")
    df = _safe_read_csv(path)

    # Keep only the columns listed in the spec (drop E_* and *_RANK columns)
    keep_cols = [
        "Season", "TEAM_ID", "TEAM_NAME", "GP", "W", "L", "W_PCT", "MIN",
        "OFF_RATING", "DEF_RATING", "NET_RATING", "AST_PCT", "AST_TO",
        "AST_RATIO", "OREB_PCT", "DREB_PCT", "REB_PCT", "TM_TOV_PCT",
        "EFG_PCT", "TS_PCT", "PACE", "POSS", "PIE",
    ]
    available = [c for c in keep_cols if c in df.columns]
    df = df[available]

    df.to_sql("team_stats_advanced", conn, if_exists="replace", index=False)
    _create_index(conn, "team_stats_advanced", ["TEAM_NAME"])
    _create_index(conn, "team_stats_advanced", ["Season"])
    row_count = conn.execute("SELECT COUNT(*) FROM team_stats_advanced").fetchone()[0]
    print(f"         -> {row_count} rows")


def ingest_tracking(conn: sqlite3.Connection) -> None:
    """(l) tracking -- from all nba_api_tracking_*.csv files.

    Each measure type has different columns, so we read all frames first,
    concatenate with a unified schema, then write once.
    """
    print("[12/13] Ingesting tracking ...")

    # One canonical file per measure type (avoid duplicates like catchshoot vs catch_shoot)
    tracking_files = {
        "catch_shoot": "nba_api_tracking_catch_shoot.csv",
        "drives": "nba_api_tracking_drives.csv",
        "passing": "nba_api_tracking_passing.csv",
        "pullup": "nba_api_tracking_pullup.csv",
        "speed_distance": "nba_api_tracking_speed_distance.csv",
    }

    frames: list[pd.DataFrame] = []

    for measure_type, filename in tracking_files.items():
        path = _source(filename)
        if not os.path.exists(path):
            # Try alternate naming
            alt = filename.replace("catch_shoot", "catchshoot").replace("pullup", "pullupshot")
            path = _source(alt)
            if not os.path.exists(path):
                print(f"         [WARN] Not found: {filename}")
                continue
            filename = alt
        try:
            df = _safe_read_csv(path)
            df["measure_type"] = measure_type
            frames.append(df)
            print(f"         {measure_type} ({filename}): {len(df)} rows")
        except Exception as exc:
            print(f"         [ERROR] {filename}: {exc}")

    if frames:
        df = pd.concat(frames, ignore_index=True)
        df.to_sql("tracking", conn, if_exists="replace", index=False)
        total_rows = len(df)
        _create_index(conn, "tracking", ["PLAYER_NAME"])
        _create_index(conn, "tracking", ["measure_type"])
    else:
        total_rows = 0

    print(f"         -> {total_rows} total rows")


def ingest_career_leaders(conn: sqlite3.Connection) -> None:
    """(m) career_leaders -- from all career_leaders_*.csv / career_*_{league}.csv files."""
    print("[13/13] Ingesting career_leaders ...")

    # Files follow pattern: career_{stat}_{league}.csv
    stat_map = {
        "3pt": "fg3",
        "assists": "ast",
        "blocks": "blk",
        "ft": "ft",
        "games": "games",
        "minutes": "min",
        "points": "pts",
        "rebounds": "reb",
        "steals": "stl",
    }
    league_map = {
        "nba": "nba",
        "aba": "aba",
        "nbaaba": "combined",
    }

    files = _source_glob("career_*.csv")
    total_rows = 0
    first = True

    for path in files:
        fname = os.path.basename(path)
        # Parse stat and league from filename  e.g. career_points_nba.csv
        m = re.match(r"career_(\w+?)_(nba|aba|nbaaba)\.csv", fname)
        if not m:
            continue
        raw_stat, raw_league = m.group(1), m.group(2)
        stat = stat_map.get(raw_stat, raw_stat)
        league = league_map.get(raw_league, raw_league)

        try:
            df = _safe_read_csv(path)
            # Rename the value column (last column, varies by stat) to 'Value'
            value_col = df.columns[-1]
            if value_col not in ("Rank", "Player", "HOF", "Active"):
                df = df.rename(columns={value_col: "Value"})

            # Keep only standard columns
            desired = ["Rank", "Player", "HOF", "Active", "Value"]
            available = [c for c in desired if c in df.columns]
            df = df[available]
            df["stat"] = stat
            df["league"] = league

            mode = "replace" if first else "append"
            df.to_sql("career_leaders", conn, if_exists=mode, index=False)
            total_rows += len(df)
            first = False
        except Exception as exc:
            print(f"         [ERROR] {fname}: {exc}")

    if total_rows > 0:
        _create_index(conn, "career_leaders", ["stat"])
        _create_index(conn, "career_leaders", ["Player"])
    print(f"         -> {total_rows} total rows")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print("=" * 60)
    print("Basketball Intelligence - Data Ingestion Pipeline")
    print("=" * 60)
    print(f"Source:  {SOURCE_DIR}")
    print(f"Target:  {DB_PATH}")
    print()

    if not os.path.isdir(SOURCE_DIR):
        print(f"ERROR: Source directory not found: {SOURCE_DIR}")
        sys.exit(1)

    os.makedirs(DATA_DIR, exist_ok=True)

    # Remove existing DB to start fresh
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        print("Removed existing database.\n")

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")

    try:
        ingest_players(conn)
        ingest_player_stats_pergame(conn)
        ingest_player_stats_advanced(conn)
        ingest_shots(conn)
        ingest_player_game_logs(conn)
        ingest_team_game_logs(conn)
        ingest_lineups(conn)
        ingest_awards(conn)
        ingest_draft(conn)
        ingest_standings(conn)
        ingest_team_stats_advanced(conn)
        ingest_tracking(conn)
        ingest_career_leaders(conn)

        conn.commit()
        print()
        print("=" * 60)
        db_size_mb = os.path.getsize(DB_PATH) / (1024 * 1024)
        print(f"Done! Database size: {db_size_mb:.1f} MB")
        print("=" * 60)
    except Exception as exc:
        print(f"\nFATAL ERROR: {exc}")
        traceback.print_exc()
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
