"""
Tests for the regression snapshot system (scripts/regression_snapshot.py).
"""
from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path

import pytest

PROJECT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_DIR / "scripts"))

from regression_snapshot import (
    ComparisonResult,
    Snapshot,
    SnapshotEntry,
    compare_snapshots,
    load_snapshot,
    save_snapshot,
    take_snapshot,
)


@pytest.fixture
def snapshot_db(tmp_path: Path) -> Path:
    """Create a minimal database for snapshot testing."""
    db_path = tmp_path / "snapshot_test.db"
    conn = sqlite3.connect(str(db_path))

    # Create the tables that sentinel queries reference
    conn.execute("CREATE TABLE players (id TEXT)")
    for i in range(100):
        conn.execute("INSERT INTO players VALUES (?)", (str(i),))

    conn.execute("CREATE TABLE player_stats_pergame (Player TEXT, Season TEXT)")
    for i in range(500):
        conn.execute(
            "INSERT INTO player_stats_pergame VALUES (?, ?)",
            (f"Player_{i}", f"202{i % 5}-{(i % 5) + 1:02d}"),
        )

    conn.execute("CREATE TABLE shots (id TEXT)")
    conn.execute("CREATE TABLE standings (Season TEXT)")
    conn.execute("INSERT INTO standings VALUES ('2024-25')")

    conn.execute("CREATE TABLE career_leaders (stat TEXT)")
    conn.execute("INSERT INTO career_leaders VALUES ('pts')")
    conn.execute("INSERT INTO career_leaders VALUES ('ast')")

    conn.commit()
    conn.close()
    return db_path


class TestTakeSnapshot:
    def test_returns_snapshot_object(self, snapshot_db: Path):
        snapshot = take_snapshot(snapshot_db)
        assert isinstance(snapshot, Snapshot)
        assert len(snapshot.entries) > 0

    def test_total_players_entry(self, snapshot_db: Path):
        snapshot = take_snapshot(snapshot_db)
        entry = next((e for e in snapshot.entries if e.query_id == "total_players"), None)
        assert entry is not None
        assert entry.value == 100

    def test_handles_missing_tables_gracefully(self, snapshot_db: Path):
        """Sentinel queries for missing tables should report errors, not crash."""
        snapshot = take_snapshot(snapshot_db)
        # player_stats_per100poss doesn't exist in this DB
        entry = next(
            (e for e in snapshot.entries if e.query_id == "total_per100poss"), None
        )
        assert entry is not None
        assert entry.error is not None

    def test_timestamp_populated(self, snapshot_db: Path):
        snapshot = take_snapshot(snapshot_db)
        assert snapshot.timestamp is not None
        assert len(snapshot.timestamp) > 0


class TestSaveAndLoadSnapshot:
    def test_roundtrip(self, snapshot_db: Path, tmp_path: Path):
        snapshot = take_snapshot(snapshot_db)
        output_path = tmp_path / "test_snapshot.json"
        save_snapshot(snapshot, output_path)

        loaded = load_snapshot(output_path)
        assert loaded.timestamp == snapshot.timestamp
        assert len(loaded.entries) == len(snapshot.entries)

    def test_json_format(self, snapshot_db: Path, tmp_path: Path):
        snapshot = take_snapshot(snapshot_db)
        output_path = tmp_path / "test.json"
        save_snapshot(snapshot, output_path)

        with open(output_path) as f:
            data = json.load(f)
        assert "timestamp" in data
        assert "entries" in data
        assert isinstance(data["entries"], dict)

    def test_creates_parent_directories(self, snapshot_db: Path, tmp_path: Path):
        snapshot = take_snapshot(snapshot_db)
        output_path = tmp_path / "nested" / "dir" / "snapshot.json"
        save_snapshot(snapshot, output_path)
        assert output_path.exists()


class TestCompareSnapshots:
    def test_identical_snapshots_pass(self, snapshot_db: Path):
        baseline = take_snapshot(snapshot_db)
        current = take_snapshot(snapshot_db)
        results = compare_snapshots(baseline, current)
        regressions = [r for r in results if r.regression]
        assert len(regressions) == 0

    def test_detects_data_loss(self):
        baseline = Snapshot(
            timestamp="2024-01-01T00:00:00",
            db_path="test.db",
            entries=(
                SnapshotEntry("total_players", "Total players", 1000),
            ),
        )
        current = Snapshot(
            timestamp="2024-01-02T00:00:00",
            db_path="test.db",
            entries=(
                SnapshotEntry("total_players", "Total players", 500),
            ),
        )
        results = compare_snapshots(baseline, current, tolerance_pct=5.0)
        assert len(results) == 1
        assert results[0].regression is True
        assert results[0].change_pct is not None
        assert results[0].change_pct < 0

    def test_allows_data_growth(self):
        baseline = Snapshot(
            timestamp="2024-01-01T00:00:00",
            db_path="test.db",
            entries=(
                SnapshotEntry("total_players", "Total players", 1000),
            ),
        )
        current = Snapshot(
            timestamp="2024-01-02T00:00:00",
            db_path="test.db",
            entries=(
                SnapshotEntry("total_players", "Total players", 1100),
            ),
        )
        results = compare_snapshots(baseline, current, tolerance_pct=5.0)
        assert len(results) == 1
        assert results[0].regression is False

    def test_within_tolerance_not_regression(self):
        baseline = Snapshot(
            timestamp="t0", db_path="test.db",
            entries=(SnapshotEntry("q", "test", 1000),),
        )
        current = Snapshot(
            timestamp="t1", db_path="test.db",
            entries=(SnapshotEntry("q", "test", 960),),  # -4%, within 5% tolerance
        )
        results = compare_snapshots(baseline, current, tolerance_pct=5.0)
        assert results[0].regression is False

    def test_handles_new_queries(self):
        baseline = Snapshot(
            timestamp="t0", db_path="test.db",
            entries=(),
        )
        current = Snapshot(
            timestamp="t1", db_path="test.db",
            entries=(SnapshotEntry("new_q", "New query", 100),),
        )
        results = compare_snapshots(baseline, current)
        assert len(results) == 1
        assert results[0].regression is False
        assert "New query" in results[0].note

    def test_handles_query_errors(self):
        baseline = Snapshot(
            timestamp="t0", db_path="test.db",
            entries=(SnapshotEntry("q", "test", 100),),
        )
        current = Snapshot(
            timestamp="t1", db_path="test.db",
            entries=(SnapshotEntry("q", "test", None, error="table missing"),),
        )
        results = compare_snapshots(baseline, current)
        assert results[0].regression is True


class TestSnapshotSerialization:
    def test_to_dict(self):
        snapshot = Snapshot(
            timestamp="2024-01-01T00:00:00",
            db_path="test.db",
            entries=(
                SnapshotEntry("q1", "desc1", 100),
                SnapshotEntry("q2", "desc2", None, error="missing"),
            ),
        )
        d = snapshot.to_dict()
        assert d["timestamp"] == "2024-01-01T00:00:00"
        assert "q1" in d["entries"]
        assert d["entries"]["q1"]["value"] == 100
        assert d["entries"]["q2"]["error"] == "missing"

    def test_from_dict(self):
        data = {
            "timestamp": "2024-01-01T00:00:00",
            "db_path": "test.db",
            "entries": {
                "q1": {"description": "desc1", "value": 100, "error": None},
            },
        }
        snapshot = Snapshot.from_dict(data)
        assert snapshot.timestamp == "2024-01-01T00:00:00"
        assert len(snapshot.entries) == 1
        assert snapshot.entries[0].value == 100
