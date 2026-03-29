"""
Tests for the validation framework (scripts/validate.py).
"""
from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

import pytest

PROJECT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_DIR / "scripts"))

from validate import (
    ValidationReport,
    ValidationResult,
    check_column_exists,
    check_no_empty_key_column,
    check_no_full_duplicates,
    check_numeric_range,
    check_row_count,
    check_table_exists,
    run_validation,
    validate_table,
)


@pytest.fixture
def db_with_tables(in_memory_db: sqlite3.Connection) -> sqlite3.Connection:
    """Create an in-memory DB with sample tables for validation testing."""
    conn = in_memory_db

    # players table with some data
    conn.execute("CREATE TABLE players (Player TEXT, Age TEXT, Pos TEXT)")
    conn.execute("INSERT INTO players VALUES ('LeBron James', '38', 'SF')")
    conn.execute("INSERT INTO players VALUES ('Stephen Curry', '35', 'PG')")
    conn.execute("INSERT INTO players VALUES ('', '25', 'C')")  # empty player name

    # table with duplicates
    conn.execute("CREATE TABLE dupes (Name TEXT, Value TEXT)")
    conn.execute("INSERT INTO dupes VALUES ('A', '1')")
    conn.execute("INSERT INTO dupes VALUES ('A', '1')")
    conn.execute("INSERT INTO dupes VALUES ('B', '2')")

    # table with numeric range issues
    conn.execute("CREATE TABLE stats (Player TEXT, Age TEXT, G TEXT)")
    conn.execute("INSERT INTO stats VALUES ('Young', '15', '82')")  # age too low
    conn.execute("INSERT INTO stats VALUES ('Normal', '25', '82')")
    conn.execute("INSERT INTO stats VALUES ('Old', '55', '82')")    # age too high

    conn.commit()
    return conn


class TestCheckTableExists:
    def test_existing_table(self, db_with_tables: sqlite3.Connection):
        result = check_table_exists(db_with_tables, "players")
        assert result.passed is True

    def test_missing_table(self, db_with_tables: sqlite3.Connection):
        result = check_table_exists(db_with_tables, "nonexistent")
        assert result.passed is False


class TestCheckRowCount:
    def test_meets_minimum(self, db_with_tables: sqlite3.Connection):
        result = check_row_count(db_with_tables, "players", min_rows=2)
        assert result.passed is True

    def test_below_minimum(self, db_with_tables: sqlite3.Connection):
        result = check_row_count(db_with_tables, "players", min_rows=100)
        assert result.passed is False

    def test_missing_table(self, db_with_tables: sqlite3.Connection):
        result = check_row_count(db_with_tables, "missing", min_rows=1)
        assert result.passed is False


class TestCheckNoEmptyKeyColumn:
    def test_column_with_empty_values(self, db_with_tables: sqlite3.Connection):
        result = check_no_empty_key_column(db_with_tables, "players", "Player")
        # Should detect the empty player name
        assert result.passed is False
        assert "1" in result.message  # 1 null/empty

    def test_column_all_populated(self, db_with_tables: sqlite3.Connection):
        result = check_no_empty_key_column(db_with_tables, "players", "Age")
        assert result.passed is True

    def test_missing_column(self, db_with_tables: sqlite3.Connection):
        result = check_no_empty_key_column(db_with_tables, "players", "Missing")
        assert result.passed is False


class TestCheckNoDuplicates:
    def test_table_with_duplicates(self, db_with_tables: sqlite3.Connection):
        result = check_no_full_duplicates(db_with_tables, "dupes")
        assert result.passed is False

    def test_table_without_duplicates(self, db_with_tables: sqlite3.Connection):
        result = check_no_full_duplicates(db_with_tables, "stats")
        assert result.passed is True


class TestCheckNumericRange:
    def test_values_in_range(self, db_with_tables: sqlite3.Connection):
        result = check_numeric_range(
            db_with_tables, "stats", "G", min_val=0, max_val=86
        )
        assert result.passed is True

    def test_values_out_of_range(self, db_with_tables: sqlite3.Connection):
        result = check_numeric_range(
            db_with_tables, "stats", "Age", min_val=17, max_val=50
        )
        assert result.passed is False


class TestCheckColumnExists:
    def test_existing_column(self, db_with_tables: sqlite3.Connection):
        result = check_column_exists(db_with_tables, "players", "Player")
        assert result.passed is True

    def test_missing_column(self, db_with_tables: sqlite3.Connection):
        result = check_column_exists(db_with_tables, "players", "Missing")
        assert result.passed is False


class TestValidationReport:
    def test_empty_report_passes(self):
        report = ValidationReport()
        assert report.passed is True
        assert report.error_count == 0

    def test_all_passing(self):
        report = ValidationReport()
        report.add(ValidationResult("t", "c", True, "ok"))
        report.add(ValidationResult("t", "c2", True, "ok"))
        assert report.passed is True

    def test_error_fails_report(self):
        report = ValidationReport()
        report.add(ValidationResult("t", "c", True, "ok"))
        report.add(ValidationResult("t", "c2", False, "fail", severity="ERROR"))
        assert report.passed is False
        assert report.error_count == 1

    def test_warnings_dont_fail_report(self):
        report = ValidationReport()
        report.add(ValidationResult("t", "c", True, "ok"))
        report.add(ValidationResult("t", "c2", False, "warn", severity="WARN"))
        assert report.passed is True
        assert report.warn_count == 1

    def test_to_dict(self):
        report = ValidationReport()
        report.add(ValidationResult("t", "check", True, "message"))
        d = report.to_dict()
        assert d["passed"] is True
        assert len(d["results"]) == 1
        assert d["results"][0]["table"] == "t"


class TestRunValidation:
    def test_returns_report_for_missing_db(self, tmp_path: Path):
        report = run_validation(tmp_path / "nonexistent.db")
        assert report.passed is False

    def test_validates_specific_table(self, populated_db: Path):
        report = run_validation(populated_db, table_filter="player_stats_per100poss")
        # Should have at least a table_exists check
        assert len(report.results) >= 1
        table_check = next(
            (r for r in report.results if r.check == "table_exists"), None
        )
        assert table_check is not None
        assert table_check.passed is True
