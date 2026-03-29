"""
Tests for the ingestion pipeline — verifies that CSV data is correctly
loaded into SQLite tables.
"""
from __future__ import annotations

import csv
import importlib.util
import sqlite3
import sys
from pathlib import Path

import pytest

PROJECT_DIR = Path(__file__).resolve().parent.parent
SRC_SCRIPTS_DIR = PROJECT_DIR / "src" / "scripts"
sys.path.insert(0, str(PROJECT_DIR / "scripts"))
sys.path.insert(0, str(SRC_SCRIPTS_DIR))


def _load_ingest_module():
    """Dynamically load ingest-basketball-data.py (has hyphen in name)."""
    spec = importlib.util.spec_from_file_location(
        "ingest_basketball_data",
        str(SRC_SCRIPTS_DIR / "ingest-basketball-data.py"),
    )
    if spec is None or spec.loader is None:
        pytest.skip("Could not load ingestion module")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# ── Tier 1 Tests ─────────────────────────────────────────────────────────────


class TestPer100PossIngestion:
    """Tests for player_stats_per100poss ingestion."""

    def test_ingests_csv_to_table(
        self, in_memory_db: sqlite3.Connection, sample_per100_csv: Path, tmp_data_dir: Path
    ):
        mod = _load_ingest_module()
        mod.build_player_stats_per100poss(in_memory_db, tmp_data_dir)

        count = in_memory_db.execute(
            "SELECT COUNT(*) FROM player_stats_per100poss"
        ).fetchone()[0]
        assert count == 2

    def test_player_names_preserved(
        self, in_memory_db: sqlite3.Connection, sample_per100_csv: Path, tmp_data_dir: Path
    ):
        mod = _load_ingest_module()
        mod.build_player_stats_per100poss(in_memory_db, tmp_data_dir)

        players = [
            r[0] for r in in_memory_db.execute(
                "SELECT Player FROM player_stats_per100poss ORDER BY Player"
            ).fetchall()
        ]
        assert "LeBron James" in players
        assert "Stephen Curry" in players

    def test_season_column_populated(
        self, in_memory_db: sqlite3.Connection, sample_per100_csv: Path, tmp_data_dir: Path
    ):
        mod = _load_ingest_module()
        mod.build_player_stats_per100poss(in_memory_db, tmp_data_dir)

        seasons = [
            r[0] for r in in_memory_db.execute(
                "SELECT DISTINCT Season FROM player_stats_per100poss"
            ).fetchall()
        ]
        assert len(seasons) >= 1
        assert "2023-24" in seasons

    def test_handles_missing_directory(
        self, in_memory_db: sqlite3.Connection, tmp_data_dir: Path
    ):
        """Should not raise if no CSV files match the glob."""
        mod = _load_ingest_module()
        # No CSV written, so glob returns empty
        empty_dir = tmp_data_dir / "empty"
        empty_dir.mkdir(exist_ok=True)
        mod.build_player_stats_per100poss(in_memory_db, empty_dir)
        # Table may not exist — that's OK for graceful handling
        tables = [
            r[0] for r in in_memory_db.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        ]
        # Either table doesn't exist or has 0 rows
        if "player_stats_per100poss" in tables:
            count = in_memory_db.execute(
                "SELECT COUNT(*) FROM player_stats_per100poss"
            ).fetchone()[0]
            assert count == 0


class TestPer36MinIngestion:
    """Tests for player_stats_per36min ingestion."""

    def test_ingests_csv_to_table(
        self, in_memory_db: sqlite3.Connection, sample_per36_csv: Path, tmp_data_dir: Path
    ):
        mod = _load_ingest_module()
        mod.build_player_stats_per36min(in_memory_db, tmp_data_dir)

        count = in_memory_db.execute(
            "SELECT COUNT(*) FROM player_stats_per36min"
        ).fetchone()[0]
        assert count == 1

    def test_player_data_correct(
        self, in_memory_db: sqlite3.Connection, sample_per36_csv: Path, tmp_data_dir: Path
    ):
        mod = _load_ingest_module()
        mod.build_player_stats_per36min(in_memory_db, tmp_data_dir)

        row = in_memory_db.execute(
            "SELECT Player, Team, Season FROM player_stats_per36min"
        ).fetchone()
        assert row[0] == "Nikola Jokic"
        assert row[1] == "DEN"
        assert row[2] == "2023-24"


class TestTotalsIngestion:
    """Tests for player_stats_totals ingestion."""

    def test_ingests_csv_to_table(
        self, in_memory_db: sqlite3.Connection, sample_totals_csv: Path, tmp_data_dir: Path
    ):
        mod = _load_ingest_module()
        mod.build_player_stats_totals(in_memory_db, tmp_data_dir)

        count = in_memory_db.execute(
            "SELECT COUNT(*) FROM player_stats_totals"
        ).fetchone()[0]
        assert count == 1

    def test_trp_dbl_column_present(
        self, in_memory_db: sqlite3.Connection, sample_totals_csv: Path, tmp_data_dir: Path
    ):
        mod = _load_ingest_module()
        mod.build_player_stats_totals(in_memory_db, tmp_data_dir)

        cols = [
            r[1] for r in in_memory_db.execute(
                "PRAGMA table_info(player_stats_totals)"
            ).fetchall()
        ]
        assert "Trp-Dbl" in cols


class TestShootingSplitsIngestion:
    """Tests for player_shooting_splits ingestion (2-row header)."""

    def test_ingests_with_positional_columns(
        self, in_memory_db: sqlite3.Connection, sample_shooting_csv: Path, tmp_data_dir: Path
    ):
        mod = _load_ingest_module()
        mod.build_player_shooting_splits(in_memory_db, tmp_data_dir)

        count = in_memory_db.execute(
            "SELECT COUNT(*) FROM player_shooting_splits"
        ).fetchone()[0]
        assert count == 1

    def test_column_names_are_clean(
        self, in_memory_db: sqlite3.Connection, sample_shooting_csv: Path, tmp_data_dir: Path
    ):
        """Verify we use our positional names, not the ugly 'Unnamed:' headers."""
        mod = _load_ingest_module()
        mod.build_player_shooting_splits(in_memory_db, tmp_data_dir)

        cols = [
            r[1] for r in in_memory_db.execute(
                "PRAGMA table_info(player_shooting_splits)"
            ).fetchall()
        ]
        assert "Player" in cols
        assert "Avg_Dist" in cols
        assert "pct_FGA_3P" in cols
        assert not any("Unnamed" in c for c in cols)

    def test_player_name_correct(
        self, in_memory_db: sqlite3.Connection, sample_shooting_csv: Path, tmp_data_dir: Path
    ):
        mod = _load_ingest_module()
        mod.build_player_shooting_splits(in_memory_db, tmp_data_dir)

        row = in_memory_db.execute(
            "SELECT Player, Season FROM player_shooting_splits"
        ).fetchone()
        assert row[0] == "Stephen Curry"
        assert row[1] == "2023-24"


# ── Tier 2 Tests ─────────────────────────────────────────────────────────────


class TestAllNBAIngestion:
    """Tests for all_nba_teams ingestion."""

    def test_ingests_csv_to_table(
        self, in_memory_db: sqlite3.Connection, sample_all_nba_csv: Path, tmp_data_dir: Path
    ):
        mod = _load_ingest_module()
        mod.build_all_nba_teams(in_memory_db, tmp_data_dir)

        count = in_memory_db.execute(
            "SELECT COUNT(*) FROM all_nba_teams"
        ).fetchone()[0]
        assert count == 3

    def test_column_names_correct(
        self, in_memory_db: sqlite3.Connection, sample_all_nba_csv: Path, tmp_data_dir: Path
    ):
        mod = _load_ingest_module()
        mod.build_all_nba_teams(in_memory_db, tmp_data_dir)

        cols = [
            r[1] for r in in_memory_db.execute(
                "PRAGMA table_info(all_nba_teams)"
            ).fetchall()
        ]
        assert "season" in cols
        assert "player_name" in cols
        assert "team_number" in cols


# ── Tier 3 Tests ─────────────────────────────────────────────────────────────


class TestInjuryHistoryIngestion:
    """Tests for injury_history ingestion."""

    def test_ingests_csv_to_table(
        self, in_memory_db: sqlite3.Connection, sample_injury_csv: Path, tmp_data_dir: Path
    ):
        mod = _load_ingest_module()
        mod.build_injury_history(in_memory_db, tmp_data_dir)

        count = in_memory_db.execute(
            "SELECT COUNT(*) FROM injury_history"
        ).fetchone()[0]
        assert count == 3

    def test_handles_missing_file_gracefully(
        self, in_memory_db: sqlite3.Connection, tmp_data_dir: Path
    ):
        """Should not raise if CSV file doesn't exist."""
        mod = _load_ingest_module()
        mod.build_injury_history(in_memory_db, tmp_data_dir)
        # Table shouldn't exist since no file
        tables = [
            r[0] for r in in_memory_db.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        ]
        assert "injury_history" not in tables


# ── Utility Function Tests ───────────────────────────────────────────────────


class TestReadCsvRows:
    """Tests for the read_csv_rows utility."""

    def test_reads_standard_csv(self, tmp_path: Path):
        mod = _load_ingest_module()
        csv_path = tmp_path / "test.csv"
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["Name", "Age"])
            writer.writerow(["Alice", "30"])
            writer.writerow(["Bob", "25"])

        headers, rows = mod.read_csv_rows(csv_path)
        assert headers == ["Name", "Age"]
        assert len(rows) == 2
        assert rows[0] == ["Alice", "30"]

    def test_handles_utf8_bom(self, tmp_path: Path):
        mod = _load_ingest_module()
        csv_path = tmp_path / "bom.csv"
        with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)
            writer.writerow(["Name", "Value"])
            writer.writerow(["Test", "123"])

        headers, rows = mod.read_csv_rows(csv_path)
        assert headers == ["Name", "Value"]

    def test_skips_mismatched_rows(self, tmp_path: Path):
        mod = _load_ingest_module()
        csv_path = tmp_path / "bad.csv"
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["A", "B", "C"])
            writer.writerow(["1", "2", "3"])
            writer.writerow(["4", "5"])  # mismatched — should be skipped
            writer.writerow(["7", "8", "9"])

        headers, rows = mod.read_csv_rows(csv_path)
        assert len(rows) == 2


class TestBulkInsert:
    """Tests for the bulk_insert utility."""

    def test_inserts_in_batches(self, in_memory_db: sqlite3.Connection):
        mod = _load_ingest_module()
        headers = ["Name", "Value"]
        mod.create_raw_table(in_memory_db, "test_table", headers)

        rows = [[f"item_{i}", str(i)] for i in range(150)]
        count = mod.bulk_insert(in_memory_db, "test_table", headers, rows, batch_size=50)
        assert count == 150

        actual = in_memory_db.execute("SELECT COUNT(*) FROM test_table").fetchone()[0]
        assert actual == 150

    def test_empty_rows(self, in_memory_db: sqlite3.Connection):
        mod = _load_ingest_module()
        headers = ["X"]
        mod.create_raw_table(in_memory_db, "empty_test", headers)
        count = mod.bulk_insert(in_memory_db, "empty_test", headers, [])
        assert count == 0


class TestCreateRawTable:
    """Tests for create_raw_table."""

    def test_creates_all_text_columns(self, in_memory_db: sqlite3.Connection):
        mod = _load_ingest_module()
        mod.create_raw_table(
            in_memory_db, "test_raw", ["col_a", "col_b", "col_c"]
        )
        cols = in_memory_db.execute("PRAGMA table_info(test_raw)").fetchall()
        assert len(cols) == 3
        assert all(c[2] == "TEXT" for c in cols)

    def test_idempotent(self, in_memory_db: sqlite3.Connection):
        mod = _load_ingest_module()
        mod.create_raw_table(in_memory_db, "test_idem", ["x"])
        mod.create_raw_table(in_memory_db, "test_idem", ["x"])
        # Should not raise
        count = in_memory_db.execute("SELECT COUNT(*) FROM test_idem").fetchone()[0]
        assert count == 0
