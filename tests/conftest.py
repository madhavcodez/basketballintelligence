"""
Shared fixtures for basketball pipeline tests.

Provides in-memory SQLite databases, temporary CSV files, and
configured paths for isolated testing.
"""
from __future__ import annotations

import csv
import os
import sqlite3
import sys
import tempfile
from pathlib import Path
from typing import Generator

import pytest

# Add project paths
PROJECT_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = PROJECT_DIR / "scripts"
SRC_SCRIPTS_DIR = PROJECT_DIR / "src" / "scripts"

sys.path.insert(0, str(SCRIPTS_DIR))
sys.path.insert(0, str(SRC_SCRIPTS_DIR))
sys.path.insert(0, str(PROJECT_DIR))


@pytest.fixture
def in_memory_db() -> Generator[sqlite3.Connection, None, None]:
    """Provide an in-memory SQLite connection."""
    conn = sqlite3.connect(":memory:")
    # WAL has no effect on :memory: databases — omitted intentionally
    yield conn
    conn.close()


@pytest.fixture
def tmp_db(tmp_path: Path) -> Generator[Path, None, None]:
    """Provide a temporary SQLite database file path."""
    db_path = tmp_path / "test_basketball.db"
    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA journal_mode = WAL")
    conn.close()
    yield db_path


@pytest.fixture
def tmp_data_dir(tmp_path: Path) -> Path:
    """Provide a temporary data directory with subdirectories matching expected layout."""
    data_dir = tmp_path / "basketball_data"
    # Create standard directory structure
    dirs = [
        "bbref/per100_stats",
        "bbref/per36_stats",
        "bbref/player_totals",
        "bbref/playoff_stats",
        "bbref/shooting_stats",
        "raw/bbref",
        "processed/enrichments",
        "processed/core",
        "processed/playoffs",
    ]
    for d in dirs:
        (data_dir / d).mkdir(parents=True, exist_ok=True)
    return data_dir


def write_csv(path: Path, headers: list[str], rows: list[list[str]]) -> Path:
    """Helper: write a CSV file with given headers and rows."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(rows)
    return path


@pytest.fixture
def sample_per100_csv(tmp_data_dir: Path) -> Path:
    """Create a sample per100poss CSV file."""
    headers = [
        "Rk", "Player", "Age", "Team", "Pos", "G", "GS", "MP",
        "FG", "FGA", "FG%", "3P", "3PA", "3P%", "2P", "2PA", "2P%", "eFG%",
        "FT", "FTA", "FT%", "ORB", "DRB", "TRB", "AST", "STL", "BLK",
        "TOV", "PF", "PTS", "ORtg", "DRtg", "Awards", "Season",
    ]
    rows = [
        ["1", "LeBron James", "38", "LAL", "SF", "71", "71", "2476",
         "12.3", "23.1", ".532", "2.1", "5.9", ".356", "10.2", "17.2", ".592", ".578",
         "7.1", "9.5", ".750", "1.2", "8.9", "10.1", "10.2", "1.5", "0.8",
         "4.1", "1.9", "33.8", "118", "113", "AS", "2023-24"],
        ["2", "Stephen Curry", "35", "GSW", "PG", "74", "74", "2432",
         "12.8", "27.2", ".471", "5.6", "14.3", ".392", "7.2", "12.9", ".558", ".574",
         "5.5", "6.1", ".902", "0.8", "5.6", "6.4", "7.1", "1.0", "0.5",
         "3.8", "3.0", "36.7", "120", "115", "AS", "2023-24"],
    ]
    return write_csv(
        tmp_data_dir / "bbref" / "per100_stats" / "bbref_player_per100poss_2024.csv",
        headers, rows,
    )


@pytest.fixture
def sample_per36_csv(tmp_data_dir: Path) -> Path:
    """Create a sample per36min CSV file."""
    headers = [
        "Rk", "Player", "Age", "Team", "Pos", "G", "GS", "MP",
        "FG", "FGA", "FG%", "3P", "3PA", "3P%", "2P", "2PA", "2P%", "eFG%",
        "FT", "FTA", "FT%", "ORB", "DRB", "TRB", "AST", "STL", "BLK",
        "TOV", "PF", "PTS", "Awards", "Season",
    ]
    rows = [
        ["1", "Nikola Jokic", "28", "DEN", "C", "79", "79", "2780",
         "9.8", "17.4", ".563", "1.5", "4.2", ".357", "8.3", "13.2", ".629", ".606",
         "5.0", "6.3", ".794", "2.8", "9.8", "12.6", "9.2", "1.4", "0.9",
         "3.5", "2.5", "26.1", "MVP-1", "2023-24"],
    ]
    return write_csv(
        tmp_data_dir / "bbref" / "per36_stats" / "bbref_player_per36min_2024.csv",
        headers, rows,
    )


@pytest.fixture
def sample_totals_csv(tmp_data_dir: Path) -> Path:
    """Create a sample totals CSV file."""
    headers = [
        "Rk", "Player", "Age", "Team", "Pos", "G", "GS", "MP",
        "FG", "FGA", "FG%", "3P", "3PA", "3P%", "2P", "2PA", "2P%", "eFG%",
        "FT", "FTA", "FT%", "ORB", "DRB", "TRB", "AST", "STL", "BLK",
        "TOV", "PF", "PTS", "Trp-Dbl", "Awards", "Season",
    ]
    rows = [
        ["1", "Luka Doncic", "24", "DAL", "PG", "70", "70", "2486",
         "689", "1472", ".468", "178", "524", ".340", "511", "948", ".539", ".528",
         "467", "623", ".750", "60", "572", "632", "613", "92", "35",
         "277", "159", "2023", "15", "AS,NBA1", "2023-24"],
    ]
    return write_csv(
        tmp_data_dir / "bbref" / "player_totals" / "bbref_player_totals_2024.csv",
        headers, rows,
    )


@pytest.fixture
def sample_all_nba_csv(tmp_data_dir: Path) -> Path:
    """Create a sample All-NBA selections CSV file."""
    headers = ["season", "league", "team_number", "player_name", "position"]
    rows = [
        ["2024-25", "NBA", "1st", "Nikola Jokic", "C"],
        ["2024-25", "NBA", "1st", "Shai Gilgeous-Alexander", "G"],
        ["2024-25", "NBA", "1st", "Giannis Antetokounmpo", "F"],
    ]
    return write_csv(
        tmp_data_dir / "raw" / "bbref" / "all_nba_selections.csv",
        headers, rows,
    )


@pytest.fixture
def sample_injury_csv(tmp_data_dir: Path) -> Path:
    """Create a sample injury history CSV file."""
    headers = ["date", "team", "acquired", "relinquished", "notes"]
    rows = [
        ["2024-01-15", "Lakers", "", "LeBron James", "left ankle sprain"],
        ["2024-01-20", "Lakers", "LeBron James", "", "activated from IL"],
        ["2024-02-01", "Celtics", "", "Jaylen Brown", "hamstring tightness"],
    ]
    return write_csv(
        tmp_data_dir / "processed" / "enrichments" / "injury_history.csv",
        headers, rows,
    )


@pytest.fixture
def sample_shooting_csv(tmp_data_dir: Path) -> Path:
    """Create a sample shooting splits CSV with 2-row multi-level header."""
    # Row 0: category groups
    row0 = [
        "Unnamed: 0_level_0", "Unnamed: 1_level_0", "Unnamed: 2_level_0",
        "Unnamed: 3_level_0", "Unnamed: 4_level_0", "Unnamed: 5_level_0",
        "Unnamed: 6_level_0", "Unnamed: 7_level_0", "Unnamed: 8_level_0",
        "Unnamed: 9_level_0",
        "% of FGA by Distance", "% of FGA by Distance", "% of FGA by Distance",
        "% of FGA by Distance", "% of FGA by Distance", "% of FGA by Distance",
        "FG% by Distance", "FG% by Distance", "FG% by Distance",
        "FG% by Distance", "FG% by Distance", "FG% by Distance",
        "% of FG Ast'd", "% of FG Ast'd",
        "Dunks", "Dunks", "Corner 3s", "Corner 3s",
        "1/2 Court", "1/2 Court",
        "Unnamed: 30_level_0", "Season",
    ]
    # Row 1: sub-column names
    row1 = [
        "Rk", "Player", "Age", "Team", "Pos", "G", "GS", "MP",
        "FG%", "Dist.",
        "2P", "0-3", "3-10", "10-16", "16-3P", "3P",
        "2P", "0-3", "3-10", "10-16", "16-3P", "3P",
        "2P", "3P",
        "%FGA", "#", "%3PA", "3P%",
        "Att.", "Md.",
        "Awards", "",
    ]
    # Data rows
    data = [
        "1", "Stephen Curry", "35", "GSW", "PG", "74", "74", "2432",
        "0.450", "15.2",
        "0.530", "0.180", "0.100", "0.100", "0.150", "0.470",
        "0.540", "0.700", "0.420", "0.380", "0.400", "0.392",
        "0.350", "0.850",
        "0.015", "11", "0.120", "0.400",
        "3", "1",
        "AS", "2023-24",
    ]

    path = tmp_data_dir / "bbref" / "shooting_stats" / "bbref_shooting_2024.csv"
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(row0)
        writer.writerow(row1)
        writer.writerow(data)
    return path


@pytest.fixture
def populated_db(
    tmp_db: Path,
    tmp_data_dir: Path,
    sample_per100_csv: Path,
    sample_per36_csv: Path,
    sample_totals_csv: Path,
    sample_all_nba_csv: Path,
    sample_injury_csv: Path,
) -> Path:
    """Create a database with some of the new tables populated for testing."""
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "ingest_basketball_data",
        str(SRC_SCRIPTS_DIR / "ingest-basketball-data.py"),
    )
    if spec is None or spec.loader is None:
        pytest.skip("Could not load ingestion module")

    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    conn = sqlite3.connect(str(tmp_db))
    conn.execute("PRAGMA journal_mode = WAL")

    try:
        # Create minimal required tables so validation doesn't fail on missing
        for table in [
            "players", "player_stats_pergame", "player_stats_advanced",
            "shots", "player_game_logs", "team_game_logs", "lineups",
            "awards", "draft", "standings", "team_stats_advanced",
            "tracking", "career_leaders",
        ]:
            conn.execute(f'CREATE TABLE IF NOT EXISTS "{table}" (id TEXT)')
            conn.execute(f'INSERT INTO "{table}" VALUES ("placeholder")')

        # Ingest the new tier 1 tables
        mod.build_player_stats_per100poss(conn, tmp_data_dir)
        mod.build_player_stats_per36min(conn, tmp_data_dir)
        mod.build_player_stats_totals(conn, tmp_data_dir)

        # Ingest tier 2
        mod.build_all_nba_teams(conn, tmp_data_dir)

        # Ingest tier 3
        mod.build_injury_history(conn, tmp_data_dir)

        conn.commit()
    finally:
        conn.close()

    return tmp_db
