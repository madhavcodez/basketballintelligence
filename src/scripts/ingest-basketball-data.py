#!/usr/bin/env python3
"""
Basketball Intelligence — CSV-to-SQLite Ingestion Script
=========================================================

Loads all CSV data from the basketball_data directory into basketball.db.

Idempotent: uses CREATE TABLE IF NOT EXISTS and INSERT OR REPLACE.
Handles missing files gracefully (skip with warning).
Checks file stability before reading (detect files still being written).

Usage:
    python src/scripts/ingest-basketball-data.py
    python src/scripts/ingest-basketball-data.py --data-dir /path/to/csvs --db-path /path/to/db
"""

from __future__ import annotations

import argparse
import csv
import glob as globmod
import os
import sqlite3
import sys
import time
from pathlib import Path
from typing import Optional

# ── Defaults ─────────────────────────────────────────────────────────────────

DEFAULT_DATA_DIR = Path(r"C:\Users\madha\Downloads\basketball_data")
DEFAULT_DB_PATH = Path(
    r"C:\Users\madha\OneDrive\Desktop\basketballintelligence\data\basketball.db"
)

# Maximum CSV field size (some shot files have large rows)
csv.field_size_limit(10 * 1024 * 1024)


# ── Utilities ────────────────────────────────────────────────────────────────


def elapsed(start: float) -> str:
    """Return human-readable elapsed time."""
    secs = time.time() - start
    if secs < 60:
        return f"{secs:.1f}s"
    return f"{secs / 60:.1f}m"


def file_is_stable(filepath: Path, wait_secs: float = 1.0) -> bool:
    """Return True if the file size is unchanged after *wait_secs*.

    Detects CSVs that are still being written by another process.
    """
    if not filepath.exists():
        return False
    size_before = filepath.stat().st_size
    if size_before == 0:
        return False
    time.sleep(wait_secs)
    size_after = filepath.stat().st_size
    return size_before == size_after


def resolve_file(data_dir: Path, *parts: str) -> Optional[Path]:
    """Try to resolve a file under *data_dir*.  Return None if not found."""
    candidate = data_dir.joinpath(*parts)
    if candidate.exists():
        return candidate
    return None


def read_csv_rows(filepath: Path) -> tuple[list[str], list[list[str]]]:
    """Read a CSV and return (headers, rows).  Handles UTF-8-BOM."""
    with open(filepath, "r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.reader(fh)
        headers = next(reader)
        # Normalize header names: strip whitespace
        headers = [h.strip() for h in headers]
        rows = [r for r in reader if len(r) == len(headers)]
    return headers, rows


def sanitize_col(name: str) -> str:
    """Sanitize a column name for SQLite — quote if needed."""
    # Keep original name but wrap in quotes to allow any characters
    return f'"{name}"'


def create_raw_table(
    conn: sqlite3.Connection,
    table_name: str,
    headers: list[str],
    *,
    primary_keys: Optional[list[str]] = None,
) -> None:
    """CREATE TABLE IF NOT EXISTS with all TEXT columns."""
    col_defs = ", ".join(f"{sanitize_col(h)} TEXT" for h in headers)
    pk_clause = ""
    if primary_keys:
        pk_cols = ", ".join(sanitize_col(k) for k in primary_keys)
        pk_clause = f", PRIMARY KEY ({pk_cols})"
    ddl = f'CREATE TABLE IF NOT EXISTS "{table_name}" ({col_defs}{pk_clause})'
    conn.execute(ddl)


def bulk_insert(
    conn: sqlite3.Connection,
    table_name: str,
    headers: list[str],
    rows: list[list[str]],
    *,
    replace: bool = True,
    batch_size: int = 5000,
) -> int:
    """INSERT OR REPLACE rows in batches.  Returns count of rows inserted."""
    if not rows:
        return 0
    cols = ", ".join(sanitize_col(h) for h in headers)
    placeholders = ", ".join("?" for _ in headers)
    verb = "INSERT OR REPLACE" if replace else "INSERT OR IGNORE"
    sql = f'{verb} INTO "{table_name}" ({cols}) VALUES ({placeholders})'

    total = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        conn.executemany(sql, batch)
        total += len(batch)
    return total


def ingest_csv(
    conn: sqlite3.Connection,
    filepath: Path,
    table_name: str,
    *,
    primary_keys: Optional[list[str]] = None,
    transform_headers: Optional[dict[str, str]] = None,
    transform_row: Optional[object] = None,
    extra_headers: Optional[list[str]] = None,
    extra_values: Optional[list[str]] = None,
    skip_stability_check: bool = False,
) -> int:
    """Full pipeline: read CSV -> create table -> insert rows.

    Returns the number of rows inserted, or -1 if skipped.
    """
    if not filepath.exists():
        print(f"  WARN: File not found — {filepath}")
        return -1

    if not skip_stability_check and not file_is_stable(filepath, wait_secs=0.5):
        print(f"  WARN: File may still be written — {filepath}")
        # Still attempt to load; we just warn

    t0 = time.time()
    headers, rows = read_csv_rows(filepath)

    # Apply header renames
    if transform_headers:
        headers = [transform_headers.get(h, h) for h in headers]

    # Apply row-level transform
    if transform_row is not None:
        new_rows = []
        for r in rows:
            result = transform_row(headers, r)
            if result is not None:
                new_rows.append(result)
        rows = new_rows

    # Append extra constant columns
    if extra_headers and extra_values:
        headers = headers + extra_headers
        rows = [r + extra_values for r in rows]

    create_raw_table(conn, table_name, headers, primary_keys=primary_keys)
    count = bulk_insert(conn, table_name, headers, rows)
    conn.commit()
    print(f"  {table_name}: {count:,} rows ({elapsed(t0)})")
    return count


# ── App-compatible table builders ────────────────────────────────────────────
#
# The Next.js app (db.ts) queries specific column names.  These functions
# build the "app tables" that the frontend expects.


def build_players_table(conn: sqlite3.Connection, data_dir: Path) -> None:
    """Build the `players` table from player_bios + player_index.

    db.ts expects: Player, Pos, Height, Weight, College, BirthDate, HOF,
                   Active, "From", "To"
    """
    print("\n[1/13] Building players table ...")

    conn.execute("DROP TABLE IF EXISTS players")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS players (
            Player TEXT,
            Pos TEXT,
            Height TEXT,
            Weight TEXT,
            College TEXT,
            BirthDate TEXT,
            HOF TEXT,
            Active INTEGER DEFAULT 0,
            "From" TEXT,
            "To" TEXT,
            person_id TEXT,
            team_abbreviation TEXT,
            country TEXT,
            draft_year TEXT,
            draft_round TEXT,
            draft_number TEXT,
            jersey_number TEXT
        )
    """)

    # Try player_index first (has more detail: position, height, weight, college)
    idx_file = resolve_file(data_dir, "processed", "core", "player_index.csv")
    if idx_file and idx_file.exists():
        headers, rows = read_csv_rows(idx_file)
        col_map = {h: i for i, h in enumerate(headers)}

        def get(row: list[str], col: str, default: str = "") -> str:
            i = col_map.get(col)
            if i is None or i >= len(row):
                return default
            return row[i].strip() if row[i] else default

        inserted = set()
        insert_sql = """
            INSERT OR REPLACE INTO players
            (Player, Pos, Height, Weight, College, BirthDate, HOF, Active,
             "From", "To", person_id, team_abbreviation, country,
             draft_year, draft_round, draft_number, jersey_number)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """
        for row in rows:
            first = get(row, "player_first_name")
            last = get(row, "player_last_name")
            name = f"{first} {last}".strip()
            if not name or name in inserted:
                continue

            roster = get(row, "roster_status", "0")
            active = 1 if roster and roster.strip() not in ("0", "", "None") else 0

            conn.execute(insert_sql, (
                name,
                get(row, "position"),
                get(row, "height"),
                get(row, "weight"),
                get(row, "college"),
                "",  # BirthDate not in player_index
                "",  # HOF
                active,
                get(row, "from_year"),
                get(row, "to_year"),
                get(row, "person_id"),
                get(row, "team_abbreviation"),
                get(row, "country"),
                get(row, "draft_year"),
                get(row, "draft_round"),
                get(row, "draft_number"),
                get(row, "jersey_number"),
            ))
            inserted.add(name)

        # Backfill from player_bios for anyone not in player_index
        bios_file = resolve_file(data_dir, "processed", "core", "player_bios.csv")
        if bios_file and bios_file.exists():
            bh, brows = read_csv_rows(bios_file)
            bio_map = {h: i for i, h in enumerate(bh)}

            def bget(row: list[str], col: str, default: str = "") -> str:
                i = bio_map.get(col)
                if i is None or i >= len(row):
                    return default
                return row[i].strip() if row[i] else default

            for row in brows:
                name = bget(row, "display_first_last")
                if not name or name in inserted:
                    continue
                roster = bget(row, "rosterstatus", "0")
                active = 1 if roster == "1" else 0
                conn.execute(insert_sql, (
                    name, "", "", "", "", "", "",
                    active,
                    bget(row, "from_year"),
                    bget(row, "to_year"),
                    bget(row, "person_id"),
                    bget(row, "team_abbreviation"),
                    "", "", "", "", "",
                ))
                inserted.add(name)

        conn.commit()
        print(f"  players: {len(inserted):,} rows")
    else:
        print("  WARN: player_index.csv not found — players table empty")


def build_player_stats_pergame(conn: sqlite3.Connection, data_dir: Path) -> None:
    """Build `player_stats_pergame` from player_stats_per_game_1997_2023.csv.

    db.ts expects columns:
        Player, Season, Tm, Pos, Age, G, GS, MP, PTS, TRB, AST, STL, BLK,
        TOV, FG, FGA, FGPct, "3P", "3PA", "3PPct", "2P", "2PA", "2PPct",
        FT, FTA, FTPct, eFGPct, ORB, DRB, PF, Awards
    """
    print("\n[5/13] Building player_stats_pergame ...")

    filepath = resolve_file(
        data_dir, "processed", "core", "player_stats_per_game_1997_2023.csv"
    )
    if not filepath:
        print("  WARN: player_stats_per_game_1997_2023.csv not found")
        return

    headers, rows = read_csv_rows(filepath)
    col_map = {h: i for i, h in enumerate(headers)}

    def get(row: list[str], col: str, default: str = "") -> str:
        i = col_map.get(col)
        if i is None or i >= len(row):
            return default
        return row[i].strip() if row[i] else default

    conn.execute("DROP TABLE IF EXISTS player_stats_pergame")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS player_stats_pergame (
            Player TEXT,
            Season TEXT,
            Tm TEXT,
            Pos TEXT,
            Age TEXT,
            G TEXT,
            GS TEXT,
            MP TEXT,
            PTS TEXT,
            TRB TEXT,
            AST TEXT,
            STL TEXT,
            BLK TEXT,
            TOV TEXT,
            FG TEXT,
            FGA TEXT,
            FGPct TEXT,
            "3P" TEXT,
            "3PA" TEXT,
            "3PPct" TEXT,
            "2P" TEXT,
            "2PA" TEXT,
            "2PPct" TEXT,
            FT TEXT,
            FTA TEXT,
            FTPct TEXT,
            eFGPct TEXT,
            ORB TEXT,
            DRB TEXT,
            PF TEXT,
            Awards TEXT,
            player_id TEXT,
            team_id TEXT,
            plus_minus TEXT,
            w TEXT,
            l TEXT,
            w_pct TEXT
        )
    """)

    insert_sql = """
        INSERT OR REPLACE INTO player_stats_pergame
        (Player, Season, Tm, Pos, Age, G, GS, MP, PTS, TRB, AST, STL, BLK,
         TOV, FG, FGA, FGPct, "3P", "3PA", "3PPct", "2P", "2PA", "2PPct",
         FT, FTA, FTPct, eFGPct, ORB, DRB, PF, Awards,
         player_id, team_id, plus_minus, w, l, w_pct)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """

    count = 0
    for row in rows:
        # Map nba_api column names to db.ts expected names
        season_raw = get(row, "season")
        conn.execute(insert_sql, (
            get(row, "player_name"),          # Player
            season_raw,                        # Season
            get(row, "team_abbreviation"),      # Tm
            "",                                # Pos (not in this CSV)
            get(row, "age"),                   # Age
            get(row, "gp"),                    # G
            "",                                # GS (not in per-game CSV)
            get(row, "min"),                   # MP
            get(row, "pts"),                   # PTS
            get(row, "reb"),                   # TRB
            get(row, "ast"),                   # AST
            get(row, "stl"),                   # STL
            get(row, "blk"),                   # BLK
            get(row, "tov"),                   # TOV
            get(row, "fgm"),                   # FG
            get(row, "fga"),                   # FGA
            get(row, "fg_pct"),                # FGPct
            get(row, "fg3m"),                  # 3P
            get(row, "fg3a"),                  # 3PA
            get(row, "fg3_pct"),               # 3PPct
            "",                                # 2P
            "",                                # 2PA
            "",                                # 2PPct
            get(row, "ftm"),                   # FT
            get(row, "fta"),                   # FTA
            get(row, "ft_pct"),                # FTPct
            "",                                # eFGPct
            get(row, "oreb"),                  # ORB
            get(row, "dreb"),                  # DRB
            get(row, "pf", get(row, "blka")),  # PF (use blka as fallback col)
            "",                                # Awards
            get(row, "player_id"),
            get(row, "team_id"),
            get(row, "plus_minus"),
            get(row, "w"),
            get(row, "l"),
            get(row, "w_pct"),
        ))
        count += 1

    conn.commit()

    # Backfill Pos, eFGPct, GS, 2P stats from nba_comprehensive_stats
    comp_file = resolve_file(
        data_dir, "processed", "enrichments", "nba_comprehensive_stats.csv"
    )
    if comp_file and comp_file.exists():
        ch, crows = read_csv_rows(comp_file)
        cm = {h: i for i, h in enumerate(ch)}

        def cget2(row: list[str], col: str, default: str = "") -> str:
            i = cm.get(col)
            if i is None or i >= len(row):
                return default
            return row[i].strip() if row[i] else default

        def year_to_nba_season_pg(year_str: str) -> str:
            try:
                year = int(float(year_str))
                next_year = year + 1
                return f"{year}-{str(next_year)[-2:]}"
            except (ValueError, TypeError):
                return year_str

        def pct_to_decimal(val: str) -> str:
            """Convert '43.80%' to '0.438' or return as-is if already decimal."""
            if not val:
                return val
            val = val.strip()
            if val.endswith("%"):
                try:
                    return str(round(float(val.rstrip("%")) / 100.0, 3))
                except ValueError:
                    return val
            return val

        backfill_pg_sql = """
            UPDATE player_stats_pergame
            SET Pos = COALESCE(NULLIF(Pos, ''), ?),
                eFGPct = COALESCE(NULLIF(eFGPct, ''), ?),
                GS = COALESCE(NULLIF(GS, ''), ?),
                "2P" = COALESCE(NULLIF("2P", ''), ?),
                "2PA" = COALESCE(NULLIF("2PA", ''), ?),
                "2PPct" = COALESCE(NULLIF("2PPct", ''), ?)
            WHERE Player = ? AND Season = ?
        """
        bf_count = 0
        for row in crows:
            name = cget2(row, "playername")
            season_raw = cget2(row, "seasonstart")
            if not name or not season_raw:
                continue
            season = year_to_nba_season_pg(season_raw)
            conn.execute(backfill_pg_sql, (
                cget2(row, "pos"),
                pct_to_decimal(cget2(row, "efg%")),
                cget2(row, "gs"),
                cget2(row, "2p"),
                cget2(row, "2pa"),
                pct_to_decimal(cget2(row, "2p%")),
                name,
                season,
            ))
            bf_count += 1
        conn.commit()
        print(f"  player_stats_pergame backfill from comprehensive: {bf_count:,} attempted")

    print(f"  player_stats_pergame: {count:,} rows")


def build_player_stats_advanced(conn: sqlite3.Connection, data_dir: Path) -> None:
    """Build `player_stats_advanced` from player_stats_advanced_1997_2023.csv.

    db.ts expects:
        Player, Season, Tm, Age, G, MP, PER, TSPct, "3PAr", FTr,
        ORBPct, DRBPct, TRBPct, ASTPct, STLPct, BLKPct, TOVPct, USGPct,
        OWS, DWS, WS, WS48, OBPM, DBPM, BPM, VORP
    """
    print("\n[6/13] Building player_stats_advanced ...")

    filepath = resolve_file(
        data_dir, "processed", "core", "player_stats_advanced_1997_2023.csv"
    )
    if not filepath:
        print("  WARN: player_stats_advanced_1997_2023.csv not found")
        return

    headers, rows = read_csv_rows(filepath)
    col_map = {h: i for i, h in enumerate(headers)}

    def get(row: list[str], col: str, default: str = "") -> str:
        i = col_map.get(col)
        if i is None or i >= len(row):
            return default
        return row[i].strip() if row[i] else default

    conn.execute("DROP TABLE IF EXISTS player_stats_advanced")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS player_stats_advanced (
            Player TEXT,
            Season TEXT,
            Tm TEXT,
            Age TEXT,
            G TEXT,
            MP TEXT,
            PER TEXT,
            TSPct TEXT,
            "3PAr" TEXT,
            FTr TEXT,
            ORBPct TEXT,
            DRBPct TEXT,
            TRBPct TEXT,
            ASTPct TEXT,
            STLPct TEXT,
            BLKPct TEXT,
            TOVPct TEXT,
            USGPct TEXT,
            OWS TEXT,
            DWS TEXT,
            WS TEXT,
            WS48 TEXT,
            OBPM TEXT,
            DBPM TEXT,
            BPM TEXT,
            VORP TEXT,
            player_id TEXT,
            team_id TEXT,
            off_rating TEXT,
            def_rating TEXT,
            net_rating TEXT,
            efg_pct TEXT,
            pace TEXT,
            pie TEXT
        )
    """)

    insert_sql = """
        INSERT OR REPLACE INTO player_stats_advanced
        (Player, Season, Tm, Age, G, MP, PER, TSPct, "3PAr", FTr,
         ORBPct, DRBPct, TRBPct, ASTPct, STLPct, BLKPct, TOVPct, USGPct,
         OWS, DWS, WS, WS48, OBPM, DBPM, BPM, VORP,
         player_id, team_id, off_rating, def_rating, net_rating, efg_pct,
         pace, pie)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """

    count = 0
    for row in rows:
        conn.execute(insert_sql, (
            get(row, "player_name"),           # Player
            get(row, "season"),                # Season
            get(row, "team_abbreviation"),      # Tm
            get(row, "age"),                   # Age
            get(row, "gp"),                    # G
            get(row, "min"),                   # MP
            "",                                # PER (not directly in nba_api advanced)
            get(row, "ts_pct"),                # TSPct
            "",                                # 3PAr
            "",                                # FTr
            get(row, "oreb_pct"),              # ORBPct
            get(row, "dreb_pct"),              # DRBPct
            get(row, "reb_pct"),               # TRBPct
            get(row, "ast_pct"),               # ASTPct
            "",                                # STLPct
            "",                                # BLKPct
            get(row, "tm_tov_pct"),            # TOVPct
            get(row, "usg_pct"),               # USGPct
            "",                                # OWS
            "",                                # DWS
            "",                                # WS
            "",                                # WS48
            "",                                # OBPM
            "",                                # DBPM
            "",                                # BPM
            "",                                # VORP
            get(row, "player_id"),
            get(row, "team_id"),
            get(row, "off_rating"),
            get(row, "def_rating"),
            get(row, "net_rating"),
            get(row, "efg_pct"),
            get(row, "pace"),
            get(row, "pie"),
        ))
        count += 1

    # Backfill PER, BPM, VORP, WS etc from nba_comprehensive_stats if available
    comp_file = resolve_file(
        data_dir, "processed", "enrichments", "nba_comprehensive_stats.csv"
    )
    if comp_file and comp_file.exists():
        ch, crows = read_csv_rows(comp_file)
        cm = {h: i for i, h in enumerate(ch)}

        def cget(row: list[str], col: str, default: str = "") -> str:
            i = cm.get(col)
            if i is None or i >= len(row):
                return default
            return row[i].strip() if row[i] else default

        def year_to_nba_season(year_str: str) -> str:
            """Convert '1997.0' or '1997' to '1997-98' NBA season format."""
            try:
                year = int(float(year_str))
                next_year = year + 1
                return f"{year}-{str(next_year)[-2:]}"
            except (ValueError, TypeError):
                return year_str

        backfill_sql = """
            UPDATE player_stats_advanced
            SET PER = COALESCE(NULLIF(PER, ''), ?),
                BPM = COALESCE(NULLIF(BPM, ''), ?),
                VORP = COALESCE(NULLIF(VORP, ''), ?),
                OWS = COALESCE(NULLIF(OWS, ''), ?),
                DWS = COALESCE(NULLIF(DWS, ''), ?),
                WS = COALESCE(NULLIF(WS, ''), ?),
                WS48 = COALESCE(NULLIF(WS48, ''), ?),
                OBPM = COALESCE(NULLIF(OBPM, ''), ?),
                DBPM = COALESCE(NULLIF(DBPM, ''), ?),
                STLPct = COALESCE(NULLIF(STLPct, ''), ?),
                BLKPct = COALESCE(NULLIF(BLKPct, ''), ?),
                "3PAr" = COALESCE(NULLIF("3PAr", ''), ?),
                FTr = COALESCE(NULLIF(FTr, ''), ?)
            WHERE Player = ? AND Season = ?
        """
        backfill_count = 0
        for row in crows:
            name = cget(row, "playername")
            season_raw = cget(row, "seasonstart")
            if not name or not season_raw:
                continue
            season = year_to_nba_season(season_raw)
            conn.execute(backfill_sql, (
                cget(row, "per"),
                cget(row, "bpm"),
                cget(row, "vorp"),
                cget(row, "ows"),
                cget(row, "dws"),
                cget(row, "ws"),
                cget(row, "ws/48"),
                cget(row, "obpm"),
                cget(row, "dbpm"),
                cget(row, "stl%"),
                cget(row, "blk%"),
                cget(row, "3par"),
                cget(row, "ftr"),
                name,
                season,
            ))
            backfill_count += 1
        print(f"  player_stats_advanced backfill from comprehensive: {backfill_count:,} attempted")

    conn.commit()
    print(f"  player_stats_advanced: {count:,} rows")


def build_shots_table(conn: sqlite3.Connection, data_dir: Path) -> None:
    """Build the `shots` table from NBA_YYYY_Shots.csv files.

    db.ts expects:
        PLAYER_NAME, LOC_X, LOC_Y, SHOT_MADE_FLAG, SHOT_ZONE_BASIC,
        SHOT_ZONE_AREA, SHOT_ZONE_RANGE, SHOT_DISTANCE, ACTION_TYPE,
        SHOT_TYPE, PERIOD, GAME_DATE, TEAM_NAME, season
    """
    print("\n[7/13] Building shots table ...")

    conn.execute("DROP TABLE IF EXISTS shots")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS shots (
            PLAYER_NAME TEXT,
            PLAYER_ID TEXT,
            TEAM_NAME TEXT,
            TEAM_ID TEXT,
            LOC_X TEXT,
            LOC_Y TEXT,
            SHOT_MADE_FLAG INTEGER,
            SHOT_ZONE_BASIC TEXT,
            SHOT_ZONE_AREA TEXT,
            SHOT_ZONE_RANGE TEXT,
            SHOT_DISTANCE TEXT,
            ACTION_TYPE TEXT,
            SHOT_TYPE TEXT,
            PERIOD TEXT,
            GAME_DATE TEXT,
            GAME_ID TEXT,
            season TEXT,
            SEASON_2 TEXT,
            POSITION TEXT,
            POSITION_GROUP TEXT,
            HOME_TEAM TEXT,
            AWAY_TEAM TEXT,
            EVENT_TYPE TEXT,
            MINS_LEFT TEXT,
            SECS_LEFT TEXT
        )
    """)

    # Try raw/other/shots/ first (actual files); processed/core/shots/ has
    # broken symlinks on Windows.
    shots_dirs = [
        data_dir / "raw" / "other" / "shots",
        data_dir / "processed" / "core" / "shots",
    ]

    total_shots = 0
    for shots_dir in shots_dirs:
        if not shots_dir.exists():
            continue

        shot_files = sorted(shots_dir.glob("NBA_*_Shots.csv"))
        if not shot_files:
            continue

        for sf in shot_files:
            try:
                if not sf.exists() or sf.stat().st_size == 0:
                    continue
            except OSError:
                # Broken symlink or inaccessible file on Windows
                print(f"  WARN: Cannot access {sf.name}, skipping")
                continue

            t0 = time.time()
            try:
                headers, rows = read_csv_rows(sf)
            except Exception as exc:
                print(f"  WARN: Failed to read {sf.name}: {exc}")
                continue

            col_map = {h: i for i, h in enumerate(headers)}

            def get(row: list[str], col: str, default: str = "") -> str:
                i = col_map.get(col)
                if i is None or i >= len(row):
                    return default
                return row[i].strip() if row[i] else default

            insert_sql = """
                INSERT INTO shots
                (PLAYER_NAME, PLAYER_ID, TEAM_NAME, TEAM_ID, LOC_X, LOC_Y,
                 SHOT_MADE_FLAG, SHOT_ZONE_BASIC, SHOT_ZONE_AREA,
                 SHOT_ZONE_RANGE, SHOT_DISTANCE, ACTION_TYPE, SHOT_TYPE,
                 PERIOD, GAME_DATE, GAME_ID, season, SEASON_2,
                 POSITION, POSITION_GROUP, HOME_TEAM, AWAY_TEAM,
                 EVENT_TYPE, MINS_LEFT, SECS_LEFT)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """

            batch = []
            for row in rows:
                # Map SHOT_MADE (TRUE/FALSE) to SHOT_MADE_FLAG (1/0)
                shot_made_raw = get(row, "SHOT_MADE", "").upper()
                if shot_made_raw in ("TRUE", "1"):
                    shot_made_flag = 1
                elif shot_made_raw in ("FALSE", "0"):
                    shot_made_flag = 0
                else:
                    shot_made_flag = 0

                # Map BASIC_ZONE to SHOT_ZONE_BASIC
                zone_basic = get(row, "BASIC_ZONE")

                batch.append((
                    get(row, "PLAYER_NAME"),
                    get(row, "PLAYER_ID"),
                    get(row, "TEAM_NAME"),
                    get(row, "TEAM_ID"),
                    get(row, "LOC_X"),
                    get(row, "LOC_Y"),
                    shot_made_flag,
                    zone_basic,                     # SHOT_ZONE_BASIC
                    get(row, "ZONE_NAME"),           # SHOT_ZONE_AREA
                    get(row, "ZONE_RANGE"),           # SHOT_ZONE_RANGE
                    get(row, "SHOT_DISTANCE"),
                    get(row, "ACTION_TYPE"),
                    get(row, "SHOT_TYPE"),
                    get(row, "QUARTER"),             # PERIOD
                    get(row, "GAME_DATE"),
                    get(row, "GAME_ID"),
                    get(row, "SEASON_1"),            # season
                    get(row, "SEASON_2"),
                    get(row, "POSITION"),
                    get(row, "POSITION_GROUP"),
                    get(row, "HOME_TEAM"),
                    get(row, "AWAY_TEAM"),
                    get(row, "EVENT_TYPE"),
                    get(row, "MINS_LEFT"),
                    get(row, "SECS_LEFT"),
                ))

                if len(batch) >= 10000:
                    conn.executemany(insert_sql, batch)
                    batch = []

            if batch:
                conn.executemany(insert_sql, batch)

            conn.commit()
            file_count = len(rows)
            total_shots += file_count
            print(f"  shots ({sf.name}): {file_count:,} rows ({elapsed(t0)})")

        # Only use first valid directory
        if total_shots > 0:
            break

    print(f"  shots TOTAL: {total_shots:,} rows")


def build_standings_table(conn: sqlite3.Connection, data_dir: Path) -> None:
    """Build the `standings` table.

    db.ts expects:
        Conference, Rank, Team, W, L, PCT, GB, PPG, OPP_PPG, DIFF, Season
    """
    print("\n[4/13] Building standings table ...")

    conn.execute("DROP TABLE IF EXISTS standings")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS standings (
            Conference TEXT,
            Rank TEXT,
            Team TEXT,
            W TEXT,
            L TEXT,
            PCT TEXT,
            GB TEXT,
            PPG TEXT,
            OPP_PPG TEXT,
            DIFF TEXT,
            Season TEXT,
            team_id TEXT,
            team_slug TEXT,
            division TEXT,
            division_rank TEXT,
            home TEXT,
            road TEXT,
            l10 TEXT,
            current_streak TEXT
        )
    """)

    # Try multiple standings file locations
    candidates = [
        data_dir / "processed" / "core" / "standings_2000_2025.csv",
        data_dir / "raw" / "nba_api" / "standings_1999_2025_proc.csv",
        data_dir / "raw" / "nba_api" / "standings_1999_2025.csv",
    ]

    filepath = None
    for c in candidates:
        if c.exists():
            filepath = c
            break

    if not filepath:
        print("  WARN: No standings CSV found")
        return

    headers, rows = read_csv_rows(filepath)
    col_map = {h: i for i, h in enumerate(headers)}

    def get(row: list[str], col: str, default: str = "") -> str:
        i = col_map.get(col)
        if i is None or i >= len(row):
            return default
        return row[i].strip() if row[i] else default

    insert_sql = """
        INSERT OR REPLACE INTO standings
        (Conference, Rank, Team, W, L, PCT, GB, PPG, OPP_PPG, DIFF, Season,
         team_id, team_slug, division, division_rank, home, road, l10,
         current_streak)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """

    count = 0
    for row in rows:
        team_name = f"{get(row, 'teamcity')} {get(row, 'teamname')}".strip()
        season = get(row, "season")
        # The seasonid is like "21999" — we need just the season portion
        if not season:
            season_id = get(row, "seasonid")
            if season_id and len(season_id) >= 4:
                # seasonid "21999" -> season year "1999"
                season = season_id[1:] if len(season_id) == 5 else season_id

        conn.execute(insert_sql, (
            get(row, "conference"),
            get(row, "playoffrank"),
            team_name,
            get(row, "wins"),
            get(row, "losses"),
            get(row, "winpct"),
            get(row, "conferencegamesback"),
            get(row, "pointspg"),
            get(row, "opppointspg"),
            get(row, "diffpointspg"),
            season,
            get(row, "teamid"),
            get(row, "teamslug"),
            get(row, "division"),
            get(row, "divisionrank"),
            get(row, "home"),
            get(row, "road"),
            get(row, "l10"),
            get(row, "strcurrentstreak"),
        ))
        count += 1

    conn.commit()
    print(f"  standings: {count:,} rows")


def build_draft_table(conn: sqlite3.Connection, data_dir: Path) -> None:
    """Build the `draft` table.

    db.ts expects: Year, Rk, Pk, Tm, Player, College
    """
    print("\n[3/13] Building draft table ...")

    filepath = resolve_file(
        data_dir, "processed", "core", "draft_history_1947_2025.csv"
    )
    if not filepath:
        print("  WARN: draft_history_1947_2025.csv not found")
        return

    conn.execute("DROP TABLE IF EXISTS draft")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS draft (
            Year TEXT,
            Rk TEXT,
            Pk TEXT,
            Tm TEXT,
            Player TEXT,
            College TEXT,
            person_id TEXT,
            team_id TEXT,
            organization TEXT,
            organization_type TEXT
        )
    """)

    headers, rows = read_csv_rows(filepath)
    col_map = {h: i for i, h in enumerate(headers)}

    def get(row: list[str], col: str, default: str = "") -> str:
        i = col_map.get(col)
        if i is None or i >= len(row):
            return default
        return row[i].strip() if row[i] else default

    insert_sql = """
        INSERT OR REPLACE INTO draft
        (Year, Rk, Pk, Tm, Player, College, person_id, team_id,
         organization, organization_type)
        VALUES (?,?,?,?,?,?,?,?,?,?)
    """

    count = 0
    for row in rows:
        conn.execute(insert_sql, (
            get(row, "season"),
            get(row, "round_number"),
            get(row, "overall_pick"),
            get(row, "team_abbreviation"),
            get(row, "player_name"),
            "",  # College not in draft CSV
            get(row, "person_id"),
            get(row, "team_id"),
            get(row, "organization"),
            get(row, "organization_type"),
        ))
        count += 1

    conn.commit()
    print(f"  draft: {count:,} rows")


def build_awards_table(conn: sqlite3.Connection, data_dir: Path) -> None:
    """Build the `awards` table.

    db.ts expects: Player, Season, Tm, award_type
    """
    print("\n[10/13] Building awards table ...")

    conn.execute("DROP TABLE IF EXISTS awards")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS awards (
            Player TEXT,
            Season TEXT,
            Tm TEXT,
            award_type TEXT
        )
    """)

    insert_sql = """
        INSERT OR REPLACE INTO awards (Player, Season, Tm, award_type)
        VALUES (?,?,?,?)
    """

    count = 0

    # Load from awards_major_1947_2025.csv
    awards_file = resolve_file(
        data_dir, "processed", "enrichments", "awards_major_1947_2025.csv"
    )
    if awards_file and awards_file.exists():
        headers, rows = read_csv_rows(awards_file)
        col_map = {h: i for i, h in enumerate(headers)}

        def get(row: list[str], col: str, default: str = "") -> str:
            i = col_map.get(col)
            if i is None or i >= len(row):
                return default
            return row[i].strip() if row[i] else default

        for row in rows:
            conn.execute(insert_sql, (
                get(row, "player_name"),
                get(row, "season"),
                get(row, "team"),
                get(row, "award_type"),
            ))
            count += 1

    # Also load awards_by_player_season.csv (may have additional entries)
    awards2_file = resolve_file(
        data_dir, "processed", "enrichments", "awards_by_player_season.csv"
    )
    if awards2_file and awards2_file.exists():
        headers, rows = read_csv_rows(awards2_file)
        col_map = {h: i for i, h in enumerate(headers)}

        def get2(row: list[str], col: str, default: str = "") -> str:
            i = col_map.get(col)
            if i is None or i >= len(row):
                return default
            return row[i].strip() if row[i] else default

        for row in rows:
            conn.execute(insert_sql, (
                get2(row, "player_name"),
                get2(row, "season"),
                get2(row, "team"),
                get2(row, "award_type"),
            ))
            count += 1

    conn.commit()
    print(f"  awards: {count:,} rows")


def build_game_logs_table(conn: sqlite3.Connection, data_dir: Path) -> None:
    """Build `player_game_logs` from player_game_logs_rs_2010_2024.csv."""
    print("\n[8/13] Building player_game_logs table ...")

    filepath = resolve_file(
        data_dir, "processed", "core", "player_game_logs_rs_2010_2024.csv"
    )
    if not filepath:
        print("  WARN: player_game_logs_rs_2010_2024.csv not found")
        return

    conn.execute("DROP TABLE IF EXISTS player_game_logs")

    t0 = time.time()
    headers, rows = read_csv_rows(filepath)

    create_raw_table(conn, "player_game_logs", headers)
    count = bulk_insert(conn, "player_game_logs", headers, rows)
    conn.commit()
    print(f"  player_game_logs: {count:,} rows ({elapsed(t0)})")


def build_team_stats_tables(conn: sqlite3.Connection, data_dir: Path) -> None:
    """Build team stats tables (raw + app-compatible views)."""
    print("\n[9/13] Building team stats tables ...")

    team_files = {
        "team_traditional_regular": "team_traditional_regular_1997_2023.csv",
        "team_advanced_regular": "team_advanced_regular_1997_2023.csv",
        "team_defense_regular": "team_defense_regular_1997_2023.csv",
        "team_four_factors_regular": "team_four_factors_regular_1997_2023.csv",
        "team_misc_regular": "team_misc_regular_1997_2023.csv",
        "team_opponent_regular": "team_opponent_regular_1997_2023.csv",
        "team_scoring_regular": "team_scoring_regular_1997_2023.csv",
    }

    for table_name, filename in team_files.items():
        filepath = resolve_file(data_dir, "processed", "core", filename)
        if filepath:
            conn.execute(f'DROP TABLE IF EXISTS "{table_name}"')
            ingest_csv(conn, filepath, table_name, skip_stability_check=True)
        else:
            print(f"  WARN: {filename} not found")

    # Build the app-compatible `team_stats_advanced` table that db.ts queries
    # db.ts expects: Season, TEAM_NAME, GP, W, L, OFF_RATING, DEF_RATING,
    #   NET_RATING, PACE, TS_PCT, EFG_PCT, AST_PCT, OREB_PCT, DREB_PCT,
    #   TM_TOV_PCT, PIE
    conn.execute("DROP TABLE IF EXISTS team_stats_advanced")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS team_stats_advanced AS
        SELECT
            season as Season,
            team_name as TEAM_NAME,
            gp as GP,
            w as W,
            l as L,
            off_rating as OFF_RATING,
            def_rating as DEF_RATING,
            net_rating as NET_RATING,
            pace as PACE,
            ts_pct as TS_PCT,
            efg_pct as EFG_PCT,
            ast_pct as AST_PCT,
            oreb_pct as OREB_PCT,
            dreb_pct as DREB_PCT,
            tm_tov_pct as TM_TOV_PCT,
            pie as PIE,
            team_id as TEAM_ID
        FROM team_advanced_regular
        WHERE team_name IS NOT NULL
    """)
    adv_count = conn.execute("SELECT COUNT(*) FROM team_stats_advanced").fetchone()[0]
    conn.commit()
    print(f"  team_stats_advanced (derived): {adv_count:,} rows")

    # Build `teams` table from team_traditional_regular
    conn.execute("DROP TABLE IF EXISTS teams")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS teams AS
        SELECT DISTINCT
            team_id as TEAM_ID,
            team_name as TEAM_NAME,
            '' as TEAM_ABBREVIATION,
            MAX(season) as latest_season
        FROM team_traditional_regular
        WHERE team_name IS NOT NULL
        GROUP BY team_id, team_name
    """)
    teams_count = conn.execute("SELECT COUNT(*) FROM teams").fetchone()[0]
    conn.commit()
    print(f"  teams (derived): {teams_count:,} rows")


def build_playoff_tables(conn: sqlite3.Connection, data_dir: Path) -> None:
    """Build playoff tables — including the app-compatible
    `player_stats_playoffs_pergame` and `player_stats_playoffs_advanced`.
    """
    print("\n[11/13] Building playoff tables ...")

    playoff_files = {
        "playoff_per_game_raw": "playoff_per_game_1997_2023.csv",
        "playoff_advanced_raw": "playoff_advanced_1997_2023.csv",
        "playoff_defense": "playoff_defense_1997_2023.csv",
        "playoff_misc": "playoff_misc_1997_2023.csv",
        "playoff_scoring": "playoff_scoring_1997_2023.csv",
        "playoff_usage": "playoff_usage_1997_2023.csv",
        "playoff_totals": "playoff_totals_2010_2024.csv",
    }

    for table_name, filename in playoff_files.items():
        filepath = resolve_file(data_dir, "processed", "playoffs", filename)
        if filepath:
            conn.execute(f'DROP TABLE IF EXISTS "{table_name}"')
            ingest_csv(conn, filepath, table_name, skip_stability_check=True)
        else:
            print(f"  WARN: {filename} not found")

    # Playoff game logs
    po_gl_file = resolve_file(
        data_dir, "processed", "playoffs", "player_game_logs_po_2010_2024.csv"
    )
    if po_gl_file:
        conn.execute("DROP TABLE IF EXISTS player_game_logs_playoffs")
        ingest_csv(conn, po_gl_file, "player_game_logs_playoffs", skip_stability_check=True)

    # Playoff team stats
    playoff_team_files = {
        "team_advanced_playoff": "team_advanced_playoff_1997_2023.csv",
        "team_defense_playoff": "team_defense_playoff_1997_2023.csv",
        "team_four_factors_playoff": "team_four_factors_playoff_1997_2023.csv",
        "team_misc_playoff": "team_misc_playoff_1997_2023.csv",
        "team_opponent_playoff": "team_opponent_playoff_1997_2023.csv",
        "team_scoring_playoff": "team_scoring_playoff_1997_2023.csv",
        "team_traditional_playoff": "team_traditional_playoff_1997_2023.csv",
    }

    for table_name, filename in playoff_team_files.items():
        filepath = resolve_file(data_dir, "processed", "playoffs", filename)
        if filepath:
            conn.execute(f'DROP TABLE IF EXISTS "{table_name}"')
            ingest_csv(conn, filepath, table_name, skip_stability_check=True)
        else:
            print(f"  WARN: {filename} not found")

    # Build app-compatible `player_stats_playoffs_pergame`
    # Must have same columns as `player_stats_pergame` for db.ts queries
    conn.execute("DROP TABLE IF EXISTS player_stats_playoffs_pergame")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS player_stats_playoffs_pergame (
            Player TEXT,
            Season TEXT,
            Tm TEXT,
            Pos TEXT,
            Age TEXT,
            G TEXT,
            GS TEXT,
            MP TEXT,
            PTS TEXT,
            TRB TEXT,
            AST TEXT,
            STL TEXT,
            BLK TEXT,
            TOV TEXT,
            FG TEXT,
            FGA TEXT,
            FGPct TEXT,
            "3P" TEXT,
            "3PA" TEXT,
            "3PPct" TEXT,
            "2P" TEXT,
            "2PA" TEXT,
            "2PPct" TEXT,
            FT TEXT,
            FTA TEXT,
            FTPct TEXT,
            eFGPct TEXT,
            ORB TEXT,
            DRB TEXT,
            PF TEXT,
            Awards TEXT,
            player_id TEXT,
            team_id TEXT,
            plus_minus TEXT
        )
    """)

    # Populate from playoff_per_game_raw
    try:
        conn.execute("""
            INSERT INTO player_stats_playoffs_pergame
            (Player, Season, Tm, Pos, Age, G, GS, MP, PTS, TRB, AST, STL, BLK,
             TOV, FG, FGA, FGPct, "3P", "3PA", "3PPct", "2P", "2PA", "2PPct",
             FT, FTA, FTPct, eFGPct, ORB, DRB, PF, Awards,
             player_id, team_id, plus_minus)
            SELECT
                player_name, season, team_abbreviation, '', age,
                gp, '', min, pts, reb, ast, stl, blk,
                tov, fgm, fga, fg_pct, fg3m, fg3a, fg3_pct,
                '', '', '',
                ftm, fta, ft_pct, '', oreb, dreb, '', '',
                player_id, team_id, plus_minus
            FROM playoff_per_game_raw
        """)
        po_pg_count = conn.execute(
            "SELECT COUNT(*) FROM player_stats_playoffs_pergame"
        ).fetchone()[0]
        print(f"  player_stats_playoffs_pergame (derived): {po_pg_count:,} rows")
    except sqlite3.OperationalError as e:
        print(f"  WARN: Could not build player_stats_playoffs_pergame: {e}")

    # Build app-compatible `player_stats_playoffs_advanced`
    conn.execute("DROP TABLE IF EXISTS player_stats_playoffs_advanced")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS player_stats_playoffs_advanced (
            Player TEXT,
            Season TEXT,
            Tm TEXT,
            Age TEXT,
            G TEXT,
            MP TEXT,
            PER TEXT,
            TSPct TEXT,
            "3PAr" TEXT,
            FTr TEXT,
            ORBPct TEXT,
            DRBPct TEXT,
            TRBPct TEXT,
            ASTPct TEXT,
            STLPct TEXT,
            BLKPct TEXT,
            TOVPct TEXT,
            USGPct TEXT,
            OWS TEXT,
            DWS TEXT,
            WS TEXT,
            WS48 TEXT,
            OBPM TEXT,
            DBPM TEXT,
            BPM TEXT,
            VORP TEXT,
            player_id TEXT,
            team_id TEXT
        )
    """)

    try:
        conn.execute("""
            INSERT INTO player_stats_playoffs_advanced
            (Player, Season, Tm, Age, G, MP, PER, TSPct, "3PAr", FTr,
             ORBPct, DRBPct, TRBPct, ASTPct, STLPct, BLKPct, TOVPct, USGPct,
             OWS, DWS, WS, WS48, OBPM, DBPM, BPM, VORP,
             player_id, team_id)
            SELECT
                player_name, season, team_abbreviation, age,
                gp, min, '', ts_pct, '', '',
                oreb_pct, dreb_pct, reb_pct, ast_pct, '', '', tm_tov_pct, usg_pct,
                '', '', '', '', '', '', '', '',
                player_id, team_id
            FROM playoff_advanced_raw
        """)
        po_adv_count = conn.execute(
            "SELECT COUNT(*) FROM player_stats_playoffs_advanced"
        ).fetchone()[0]
        print(f"  player_stats_playoffs_advanced (derived): {po_adv_count:,} rows")
    except sqlite3.OperationalError as e:
        print(f"  WARN: Could not build player_stats_playoffs_advanced: {e}")

    conn.commit()


# ── NEW: 18 Additional Table Ingestion Functions ────────────────────────────
#
# Tier 1: BBRef multi-season CSVs
# Tier 2: Enrichment single-file CSVs
# Tier 3: Playoff extended


def _ingest_bbref_multi_season(
    conn: sqlite3.Connection,
    data_dir: Path,
    table_name: str,
    glob_pattern: str,
    *,
    positional_columns: tuple[str, ...] | None = None,
    skip_header_row: bool = False,
    label: str = "",
) -> int:
    """Generic ingester for BBRef multi-season CSV directories.

    Each CSV has a header row. We read headers from the CSV directly.
    For shooting splits (has_multi_header), we skip the first header row
    and assign positional column names.

    Returns total row count inserted.
    """
    pattern = str(data_dir / glob_pattern)
    files = sorted(globmod.glob(pattern))
    if not files:
        print(f"  WARN: No files matched {glob_pattern}")
        return 0

    total_rows = 0
    first_file = True

    for filepath_str in files:
        filepath = Path(filepath_str)

        if positional_columns:
            # Shooting splits: skip the multi-level header rows, use positional cols
            with open(filepath, "r", encoding="utf-8-sig", newline="") as fh:
                reader = csv.reader(fh)
                _row0 = next(reader)  # first header row (category groups)
                _row1 = next(reader)  # second header row (sub-column names)
                rows = []
                skipped = 0
                for r in reader:
                    if len(r) >= len(positional_columns):
                        rows.append(r[:len(positional_columns)])
                    else:
                        skipped += 1
                if skipped > 0:
                    print(f"  WARN: {filepath.name}: skipped {skipped} rows with fewer than {len(positional_columns)} columns")
            headers = list(positional_columns)
        else:
            headers, rows = read_csv_rows(filepath)

        if not rows:
            continue

        # Add Season column from CSV data if present, otherwise keep as-is
        # BBRef CSVs already have a Season column in the data

        if first_file:
            conn.execute(f'DROP TABLE IF EXISTS "{table_name}"')
            create_raw_table(conn, table_name, headers)
            first_file = False

        count = bulk_insert(conn, table_name, headers, rows, replace=False)
        total_rows += count

    conn.commit()
    print(f"  {label or table_name}: {total_rows:,} rows")
    return total_rows


def build_player_stats_per100poss(conn: sqlite3.Connection, data_dir: Path) -> None:
    """Tier 1: Per-100 possessions stats from BBRef (1980-2025)."""
    print("\n  [NEW-1/18] Building player_stats_per100poss ...")
    count = _ingest_bbref_multi_season(
        conn, data_dir,
        "player_stats_per100poss",
        "bbref/per100_stats/bbref_player_per100poss_*.csv",
        label="player_stats_per100poss",
    )
    if count > 0:
        conn.execute(
            'CREATE INDEX IF NOT EXISTS idx_per100_player_season '
            'ON player_stats_per100poss(Player, Season)'
        )
        conn.commit()


def build_player_stats_per36min(conn: sqlite3.Connection, data_dir: Path) -> None:
    """Tier 1: Per-36 minutes stats from BBRef (1980-2025)."""
    print("\n  [NEW-2/18] Building player_stats_per36min ...")
    count = _ingest_bbref_multi_season(
        conn, data_dir,
        "player_stats_per36min",
        "bbref/per36_stats/bbref_player_per36min_*.csv",
        label="player_stats_per36min",
    )
    if count > 0:
        conn.execute(
            'CREATE INDEX IF NOT EXISTS idx_per36_player_season '
            'ON player_stats_per36min(Player, Season)'
        )
        conn.commit()


def build_player_stats_totals(conn: sqlite3.Connection, data_dir: Path) -> None:
    """Tier 1: Season totals from BBRef (1980-2025)."""
    print("\n  [NEW-3/18] Building player_stats_totals ...")
    count = _ingest_bbref_multi_season(
        conn, data_dir,
        "player_stats_totals",
        "bbref/player_totals/bbref_player_totals_*.csv",
        label="player_stats_totals",
    )
    if count > 0:
        conn.execute(
            'CREATE INDEX IF NOT EXISTS idx_totals_player_season '
            'ON player_stats_totals(Player, Season)'
        )
        conn.commit()


def build_player_stats_playoffs_pergame_bbref(
    conn: sqlite3.Connection, data_dir: Path
) -> None:
    """Tier 1: Playoff per-game stats from BBRef (1980-2025)."""
    print("\n  [NEW-4/18] Building player_stats_playoffs_pergame_bbref ...")
    count = _ingest_bbref_multi_season(
        conn, data_dir,
        "player_stats_playoffs_pergame_bbref",
        "bbref/playoff_stats/player_playoffs_pergame_*.csv",
        label="player_stats_playoffs_pergame_bbref",
    )
    if count > 0:
        conn.execute(
            'CREATE INDEX IF NOT EXISTS idx_po_bbref_player_season '
            'ON player_stats_playoffs_pergame_bbref(Player, Season)'
        )
        conn.commit()


def build_player_shooting_splits(conn: sqlite3.Connection, data_dir: Path) -> None:
    """Tier 1: Shooting splits from BBRef (2000-2025).

    CRITICAL: These CSVs have a 2-row multi-level header. We skip both
    header rows and assign 32 positional column names.
    """
    print("\n  [NEW-5/18] Building player_shooting_splits ...")

    positional_cols = (
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
    )

    count = _ingest_bbref_multi_season(
        conn, data_dir,
        "player_shooting_splits",
        "bbref/shooting_stats/bbref_shooting_*.csv",
        positional_columns=positional_cols,
        label="player_shooting_splits",
    )
    if count > 0:
        conn.execute(
            'CREATE INDEX IF NOT EXISTS idx_shooting_player_season '
            'ON player_shooting_splits(Player, Season)'
        )
        conn.commit()


def _ingest_single_file_table(
    conn: sqlite3.Connection,
    data_dir: Path,
    table_name: str,
    relative_path: str,
    *,
    label: str = "",
) -> int:
    """Generic ingester for a single-file CSV.

    Returns row count or -1 if file not found.
    """
    filepath = data_dir / relative_path
    if not filepath.exists():
        print(f"  WARN: {relative_path} not found")
        return -1

    conn.execute(f'DROP TABLE IF EXISTS "{table_name}"')
    count = ingest_csv(conn, filepath, table_name, skip_stability_check=True)
    print_label = label or table_name
    if count >= 0:
        print(f"  {print_label}: {count:,} rows (done)")
    return count


def build_all_nba_teams(conn: sqlite3.Connection, data_dir: Path) -> None:
    """Tier 2: All-NBA team selections."""
    print("\n  [NEW-6/18] Building all_nba_teams ...")
    count = _ingest_single_file_table(
        conn, data_dir,
        "all_nba_teams",
        "raw/bbref/all_nba_selections.csv",
    )
    if count and count > 0:
        conn.execute(
            'CREATE INDEX IF NOT EXISTS idx_allnba_player '
            'ON all_nba_teams(player_name)'
        )
        conn.execute(
            'CREATE INDEX IF NOT EXISTS idx_allnba_season '
            'ON all_nba_teams(season)'
        )
        conn.commit()


def build_all_defense_teams(conn: sqlite3.Connection, data_dir: Path) -> None:
    """Tier 2: All-Defensive team selections."""
    print("\n  [NEW-7/18] Building all_defense_teams ...")
    count = _ingest_single_file_table(
        conn, data_dir,
        "all_defense_teams",
        "raw/bbref/all_defense_selections.csv",
    )
    if count and count > 0:
        conn.execute(
            'CREATE INDEX IF NOT EXISTS idx_alldef_player '
            'ON all_defense_teams(player_name)'
        )
        conn.execute(
            'CREATE INDEX IF NOT EXISTS idx_alldef_season '
            'ON all_defense_teams(season)'
        )
        conn.commit()


def build_all_star_selections(conn: sqlite3.Connection, data_dir: Path) -> None:
    """Tier 2: All-Star selection counts by player."""
    print("\n  [NEW-8/18] Building all_star_selections_new ...")
    count = _ingest_single_file_table(
        conn, data_dir,
        "all_star_selections_new",
        "processed/enrichments/all_star_selections_by_player.csv",
    )
    if count and count > 0:
        conn.execute(
            'CREATE INDEX IF NOT EXISTS idx_allstar_player '
            'ON all_star_selections_new(player)'
        )
        conn.commit()


def build_awards_major(conn: sqlite3.Connection, data_dir: Path) -> None:
    """Tier 2: Major award winners 1947-2025."""
    print("\n  [NEW-9/18] Building awards_major ...")
    count = _ingest_single_file_table(
        conn, data_dir,
        "awards_major",
        "processed/enrichments/awards_major_1947_2025.csv",
    )
    if count and count > 0:
        conn.execute(
            'CREATE INDEX IF NOT EXISTS idx_awards_major_player '
            'ON awards_major(player_name)'
        )
        conn.execute(
            'CREATE INDEX IF NOT EXISTS idx_awards_major_season '
            'ON awards_major(season)'
        )
        conn.commit()


def build_contracts(conn: sqlite3.Connection, data_dir: Path) -> None:
    """Tier 2: Player contracts and salaries."""
    print("\n  [NEW-10/18] Building contracts ...")
    count = _ingest_single_file_table(
        conn, data_dir,
        "contracts",
        "processed/enrichments/contracts_salaries.csv",
    )
    if count and count > 0:
        conn.execute(
            'CREATE INDEX IF NOT EXISTS idx_contracts_name '
            'ON contracts(name)'
        )
        conn.execute(
            'CREATE INDEX IF NOT EXISTS idx_contracts_season '
            'ON contracts(season)'
        )
        conn.commit()


def build_draft_combine(conn: sqlite3.Connection, data_dir: Path) -> None:
    """Tier 2: NBA Draft Combine measurements."""
    print("\n  [NEW-11/18] Building draft_combine ...")
    count = _ingest_single_file_table(
        conn, data_dir,
        "draft_combine",
        "processed/enrichments/draft_combine_measurements.csv",
    )
    if count and count > 0:
        conn.execute(
            'CREATE INDEX IF NOT EXISTS idx_combine_player '
            'ON draft_combine(player)'
        )
        conn.execute(
            'CREATE INDEX IF NOT EXISTS idx_combine_year '
            'ON draft_combine(year)'
        )
        conn.commit()


def build_team_four_factors(conn: sqlite3.Connection, data_dir: Path) -> None:
    """Tier 2: Team Four Factors (regular season 1997-2023)."""
    print("\n  [NEW-12/18] Building team_four_factors ...")
    count = _ingest_single_file_table(
        conn, data_dir,
        "team_four_factors",
        "processed/core/team_four_factors_regular_1997_2023.csv",
    )
    if count and count > 0:
        conn.execute(
            'CREATE INDEX IF NOT EXISTS idx_t4f_team_season '
            'ON team_four_factors(team_name, season)'
        )
        conn.commit()


def build_team_opponent_pergame(conn: sqlite3.Connection, data_dir: Path) -> None:
    """Tier 2: Team opponent per-game stats."""
    print("\n  [NEW-13/18] Building team_opponent_pergame ...")
    count = _ingest_single_file_table(
        conn, data_dir,
        "team_opponent_pergame",
        "processed/core/team_opponent_regular_1997_2023.csv",
    )
    if count and count > 0:
        conn.execute(
            'CREATE INDEX IF NOT EXISTS idx_topp_team_season '
            'ON team_opponent_pergame(team_name, season)'
        )
        conn.commit()


def build_player_stats_defense(conn: sqlite3.Connection, data_dir: Path) -> None:
    """Tier 2: Player defensive stats."""
    print("\n  [NEW-14/18] Building player_stats_defense_new ...")
    count = _ingest_single_file_table(
        conn, data_dir,
        "player_stats_defense_new",
        "processed/enrichments/player_stats_defense_1997_2023.csv",
    )
    if count and count > 0:
        conn.execute(
            'CREATE INDEX IF NOT EXISTS idx_def_player_season '
            'ON player_stats_defense_new(player_name, season)'
        )
        conn.commit()


def build_player_stats_scoring(conn: sqlite3.Connection, data_dir: Path) -> None:
    """Tier 2: Player scoring stats."""
    print("\n  [NEW-15/18] Building player_stats_scoring_new ...")
    count = _ingest_single_file_table(
        conn, data_dir,
        "player_stats_scoring_new",
        "processed/enrichments/player_stats_scoring_1997_2023.csv",
    )
    if count and count > 0:
        conn.execute(
            'CREATE INDEX IF NOT EXISTS idx_scoring_player_season '
            'ON player_stats_scoring_new(player_name, season)'
        )
        conn.commit()


def build_player_stats_usage(conn: sqlite3.Connection, data_dir: Path) -> None:
    """Tier 2: Player usage stats."""
    print("\n  [NEW-16/18] Building player_stats_usage_new ...")
    count = _ingest_single_file_table(
        conn, data_dir,
        "player_stats_usage_new",
        "processed/enrichments/player_stats_usage_1997_2023.csv",
    )
    if count and count > 0:
        conn.execute(
            'CREATE INDEX IF NOT EXISTS idx_usage_player_season '
            'ON player_stats_usage_new(player_name, season)'
        )
        conn.commit()


def build_playoff_game_logs(conn: sqlite3.Connection, data_dir: Path) -> None:
    """Tier 3: Playoff individual game logs (2010-2024)."""
    print("\n  [NEW-17/18] Building playoff_game_logs ...")
    count = _ingest_single_file_table(
        conn, data_dir,
        "playoff_game_logs",
        "processed/playoffs/player_game_logs_po_2010_2024.csv",
    )
    if count and count > 0:
        conn.execute(
            'CREATE INDEX IF NOT EXISTS idx_pogl_person_season '
            'ON playoff_game_logs(personname, season_year)'
        )
        conn.execute(
            'CREATE INDEX IF NOT EXISTS idx_pogl_game_date '
            'ON playoff_game_logs(game_date)'
        )
        conn.commit()


def build_injury_history(conn: sqlite3.Connection, data_dir: Path) -> None:
    """Tier 3: Injury transaction history."""
    print("\n  [NEW-18/18] Building injury_history ...")
    count = _ingest_single_file_table(
        conn, data_dir,
        "injury_history",
        "processed/enrichments/injury_history.csv",
    )
    if count and count > 0:
        conn.execute(
            'CREATE INDEX IF NOT EXISTS idx_injury_team '
            'ON injury_history(team)'
        )
        conn.execute(
            'CREATE INDEX IF NOT EXISTS idx_injury_date '
            'ON injury_history(date)'
        )
        conn.commit()


def build_all_new_tables(conn: sqlite3.Connection, data_dir: Path) -> None:
    """Orchestrate ingestion of all 18 new tables."""
    print("\n" + "=" * 70)
    print("INGESTING 18 NEW TABLES")
    print("=" * 70)

    # Tier 1: BBRef multi-season
    build_player_stats_per100poss(conn, data_dir)
    build_player_stats_per36min(conn, data_dir)
    build_player_stats_totals(conn, data_dir)
    build_player_stats_playoffs_pergame_bbref(conn, data_dir)
    build_player_shooting_splits(conn, data_dir)

    # Tier 2: Enrichment single-file
    build_all_nba_teams(conn, data_dir)
    build_all_defense_teams(conn, data_dir)
    build_all_star_selections(conn, data_dir)
    build_awards_major(conn, data_dir)
    build_contracts(conn, data_dir)
    build_draft_combine(conn, data_dir)
    build_team_four_factors(conn, data_dir)
    build_team_opponent_pergame(conn, data_dir)
    build_player_stats_defense(conn, data_dir)
    build_player_stats_scoring(conn, data_dir)
    build_player_stats_usage(conn, data_dir)

    # Tier 3: Playoff extended
    build_playoff_game_logs(conn, data_dir)
    build_injury_history(conn, data_dir)

    conn.execute("ANALYZE")
    conn.commit()
    print("\n  All 18 new tables ingested. ANALYZE complete.")


def build_enrichment_tables(conn: sqlite3.Connection, data_dir: Path) -> None:
    """Load all enrichment CSVs as raw tables."""
    print("\n[12/13] Building enrichment tables ...")

    enrichment_files = {
        "all_star_selections": "all_star_selections_by_player.csv",
        "contracts_salaries": "contracts_salaries.csv",
        "injury_history": "injury_history.csv",
        "nba_comprehensive_stats": "nba_comprehensive_stats.csv",
        "player_career_timeline_index": "player_career_timeline_index.csv",
        "player_stats_defense": "player_stats_defense_1997_2023.csv",
        "player_stats_misc": "player_stats_misc_1997_2023.csv",
        "player_stats_scoring": "player_stats_scoring_1997_2023.csv",
        "player_stats_usage": "player_stats_usage_1997_2023.csv",
        "player_team_season_index": "player_team_season_index.csv",
        "playoff_vs_regular_comparison": "playoff_vs_regular_comparison.csv",
        "shot_zone_aggregates": "shot_zone_aggregates_by_player_2025.csv",
        "team_season_context": "team_season_context.csv",
    }

    for table_name, filename in enrichment_files.items():
        filepath = resolve_file(data_dir, "processed", "enrichments", filename)
        if filepath:
            conn.execute(f'DROP TABLE IF EXISTS "{table_name}"')
            ingest_csv(conn, filepath, table_name, skip_stability_check=True)
        else:
            print(f"  WARN: {filename} not found")


def build_raw_core_tables(conn: sqlite3.Connection, data_dir: Path) -> None:
    """Load raw CSV copies of core files for maximum data availability."""
    print("\n  Loading raw core CSVs ...")

    raw_files = {
        "player_bios_raw": ("processed", "core", "player_bios.csv"),
        "player_index_raw": ("processed", "core", "player_index.csv"),
        "draft_history_raw": ("processed", "core", "draft_history_1947_2025.csv"),
        "player_stats_per_game_raw": (
            "processed", "core", "player_stats_per_game_1997_2023.csv"
        ),
        "player_stats_advanced_raw": (
            "processed", "core", "player_stats_advanced_1997_2023.csv"
        ),
        "player_totals_raw": ("processed", "core", "player_totals_2010_2024.csv"),
        "career_leaders_all_time_raw": (
            "processed", "core", "career_leaders_all_time.csv"
        ),
    }

    for table_name, path_parts in raw_files.items():
        filepath = resolve_file(data_dir, *path_parts)
        if filepath:
            conn.execute(f'DROP TABLE IF EXISTS "{table_name}"')
            ingest_csv(conn, filepath, table_name, skip_stability_check=True)
        else:
            print(f"  WARN: {'/'.join(path_parts)} not found")


def build_career_leaders(conn: sqlite3.Connection, data_dir: Path) -> None:
    """Build the `career_leaders` table for getCareerLeaders().

    db.ts expects: stat, league, Rank, Player, HOF, Active, Value
    """
    filepath = resolve_file(
        data_dir, "processed", "core", "career_leaders_all_time.csv"
    )
    if not filepath:
        print("  WARN: career_leaders_all_time.csv not found")
        return

    conn.execute("DROP TABLE IF EXISTS career_leaders")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS career_leaders (
            stat TEXT,
            league TEXT DEFAULT 'nba',
            Rank TEXT,
            Player TEXT,
            HOF TEXT DEFAULT '',
            Active TEXT DEFAULT '',
            Value TEXT
        )
    """)

    headers, rows = read_csv_rows(filepath)
    col_map = {h: i for i, h in enumerate(headers)}

    def get(row: list[str], col: str, default: str = "") -> str:
        i = col_map.get(col)
        if i is None or i >= len(row):
            return default
        return row[i].strip() if row[i] else default

    insert_sql = """
        INSERT OR REPLACE INTO career_leaders (stat, league, Rank, Player, Value)
        VALUES (?, 'nba', ?, ?, ?)
    """

    count = 0
    rank_counter: dict[str, int] = {}
    for row in rows:
        stat_cat = get(row, "stat_category")
        player = get(row, "player_name")
        value = get(row, "value")
        if not stat_cat or not player:
            continue

        rank_counter[stat_cat] = rank_counter.get(stat_cat, 0) + 1
        conn.execute(insert_sql, (
            stat_cat,
            str(rank_counter[stat_cat]),
            player,
            value,
        ))
        count += 1

    conn.commit()
    print(f"  career_leaders: {count:,} rows")


def build_derived_views(conn: sqlite3.Connection) -> None:
    """Create derived views and summary tables after all data is loaded."""
    print("\n[13/13] Building derived views and indexes ...")

    # player_awards view
    conn.execute("DROP VIEW IF EXISTS player_awards")
    conn.execute("""
        CREATE VIEW IF NOT EXISTS player_awards AS
        SELECT
            a.Player,
            a.Season,
            a.Tm,
            a.award_type,
            p.Pos,
            p.Active
        FROM awards a
        LEFT JOIN players p ON a.Player = p.Player
    """)
    print("  VIEW player_awards created")

    # team_rosters view (current team from latest season)
    conn.execute("DROP VIEW IF EXISTS team_rosters")
    conn.execute("""
        CREATE VIEW IF NOT EXISTS team_rosters AS
        SELECT
            s.Player,
            s.Tm,
            s.Season,
            s.Age,
            s.G,
            s.PTS,
            s.TRB,
            s.AST,
            p.Pos,
            p.Height,
            p.Weight
        FROM player_stats_pergame s
        LEFT JOIN players p ON s.Player = p.Player
        WHERE s.Season = (SELECT MAX(Season) FROM player_stats_pergame)
    """)
    print("  VIEW team_rosters created")

    conn.commit()


def create_indexes(conn: sqlite3.Connection) -> None:
    """Create indexes on frequently queried columns."""
    print("\n  Creating indexes ...")

    indexes = [
        # players
        ("idx_players_player", "players", "Player"),
        ("idx_players_active", "players", "Active"),

        # player_stats_pergame
        ("idx_pspg_player", "player_stats_pergame", "Player"),
        ("idx_pspg_season", "player_stats_pergame", "Season"),
        ("idx_pspg_tm", "player_stats_pergame", "Tm"),
        ("idx_pspg_player_season", "player_stats_pergame", "Player, Season"),

        # player_stats_advanced
        ("idx_psa_player", "player_stats_advanced", "Player"),
        ("idx_psa_season", "player_stats_advanced", "Season"),
        ("idx_psa_player_season", "player_stats_advanced", "Player, Season"),

        # shots
        ("idx_shots_player", "shots", "PLAYER_NAME"),
        ("idx_shots_season", "shots", "season"),
        ("idx_shots_player_season", "shots", "PLAYER_NAME, season"),
        ("idx_shots_game_date", "shots", "GAME_DATE"),
        ("idx_shots_zone", "shots", "SHOT_ZONE_BASIC"),

        # standings
        ("idx_standings_season", "standings", "Season"),
        ("idx_standings_team", "standings", "Team"),
        ("idx_standings_conf", "standings", "Conference"),

        # awards
        ("idx_awards_player", "awards", "Player"),
        ("idx_awards_season", "awards", "Season"),

        # draft
        ("idx_draft_player", "draft", "Player"),
        ("idx_draft_year", "draft", "Year"),

        # career_leaders
        ("idx_cl_stat", "career_leaders", "stat"),
        ("idx_cl_stat_league", "career_leaders", "stat, league"),

        # game logs
        ("idx_gl_personname", "player_game_logs", "personname"),
        ("idx_gl_season", "player_game_logs", "season_year"),
        ("idx_gl_game_date", "player_game_logs", "game_date"),

        # team_stats_advanced
        ("idx_tsa_team", "team_stats_advanced", "TEAM_NAME"),
        ("idx_tsa_season", "team_stats_advanced", "Season"),

        # playoff per game
        ("idx_ppg_player", "player_stats_playoffs_pergame", "Player"),
        ("idx_ppg_season", "player_stats_playoffs_pergame", "Season"),
        ("idx_ppg_player_season", "player_stats_playoffs_pergame", "Player, Season"),

        # playoff advanced
        ("idx_ppa_player", "player_stats_playoffs_advanced", "Player"),
        ("idx_ppa_season", "player_stats_playoffs_advanced", "Season"),
    ]

    for idx_name, table, cols in indexes:
        try:
            conn.execute(
                f'CREATE INDEX IF NOT EXISTS "{idx_name}" ON "{table}" ({cols})'
            )
        except sqlite3.OperationalError:
            # Table may not exist
            pass

    conn.commit()
    print(f"  Created {len(indexes)} indexes (some may have been skipped)")


def build_player_bios_and_index_raw(
    conn: sqlite3.Connection, data_dir: Path
) -> None:
    """Steps 1-2: Ingest player_bios and player_index as raw tables,
    then build the app-compatible `players` table."""
    build_players_table(conn, data_dir)


# ── Main Orchestrator ────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Ingest basketball CSV data into SQLite"
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=DEFAULT_DATA_DIR,
        help=f"Root directory of basketball CSV data (default: {DEFAULT_DATA_DIR})",
    )
    parser.add_argument(
        "--db-path",
        type=Path,
        default=DEFAULT_DB_PATH,
        help=f"Path to output SQLite database (default: {DEFAULT_DB_PATH})",
    )
    args = parser.parse_args()

    data_dir: Path = args.data_dir
    db_path: Path = args.db_path

    # Validate data directory
    if not data_dir.exists():
        print(f"ERROR: Data directory not found: {data_dir}")
        sys.exit(1)

    # Ensure output directory exists
    db_path.parent.mkdir(parents=True, exist_ok=True)

    print("=" * 70)
    print("Basketball Intelligence — Data Ingestion")
    print("=" * 70)
    print(f"  Data dir : {data_dir}")
    print(f"  DB path  : {db_path}")
    print()

    overall_start = time.time()

    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    conn.execute("PRAGMA cache_size = -65536")  # 64MB
    conn.execute("PRAGMA temp_store = MEMORY")

    try:
        # ── Ingestion Order (as specified) ────────────────────────────────

        # 1-2. Player bios + player_index -> players table
        build_player_bios_and_index_raw(conn, data_dir)

        # Also load raw copies for data availability
        print("\n[2/13] Loading raw core CSV tables ...")
        build_raw_core_tables(conn, data_dir)

        # 3. Draft history
        build_draft_table(conn, data_dir)

        # 4. Standings
        build_standings_table(conn, data_dir)

        # 5. Player stats per game
        build_player_stats_pergame(conn, data_dir)

        # 6. Player stats advanced
        build_player_stats_advanced(conn, data_dir)

        # 7. Shot charts
        build_shots_table(conn, data_dir)

        # 8. Player game logs
        build_game_logs_table(conn, data_dir)

        # 9. Team stats
        build_team_stats_tables(conn, data_dir)

        # 10. Awards
        build_awards_table(conn, data_dir)

        # Career leaders
        build_career_leaders(conn, data_dir)

        # 11. Playoffs
        build_playoff_tables(conn, data_dir)

        # 12. Enrichments
        build_enrichment_tables(conn, data_dir)

        # 13. Derived views + indexes
        build_derived_views(conn)
        create_indexes(conn)

        # 14. NEW: 18 additional tables (Tier 1-3)
        build_all_new_tables(conn, data_dir)

        # ── Final Summary ─────────────────────────────────���───────────────

        print("\n" + "=" * 70)
        print("INGESTION COMPLETE")
        print("=" * 70)

        # Count rows in key tables
        key_tables = [
            "players", "player_stats_pergame", "player_stats_advanced",
            "shots", "standings", "draft", "awards", "career_leaders",
            "player_game_logs", "team_stats_advanced", "teams",
            "player_stats_playoffs_pergame", "player_stats_playoffs_advanced",
            # New tables
            "player_stats_per100poss", "player_stats_per36min",
            "player_stats_totals", "player_stats_playoffs_pergame_bbref",
            "player_shooting_splits",
            "all_nba_teams", "all_defense_teams", "all_star_selections_new",
            "awards_major", "contracts", "draft_combine",
            "team_four_factors", "team_opponent_pergame",
            "player_stats_defense_new", "player_stats_scoring_new",
            "player_stats_usage_new",
            "playoff_game_logs", "injury_history",
        ]
        for t in key_tables:
            try:
                count = conn.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
                print(f"  {t:40s} {count:>10,} rows")
            except sqlite3.OperationalError:
                print(f"  {t:40s}     (missing)")

        db_size_mb = db_path.stat().st_size / (1024 * 1024)
        print(f"\n  Database size: {db_size_mb:.1f} MB")
        print(f"  Total time: {elapsed(overall_start)}")

    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
