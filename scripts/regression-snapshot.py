#!/usr/bin/env python3
"""Regression snapshot for film.db and basketball.db.

Captures table counts and unique categorical values, saves to JSON,
and compares against a previous snapshot to detect regressions
(any count decrease flags a warning).

Usage:
    python scripts/regression-snapshot.py --capture
    python scripts/regression-snapshot.py --compare
    python scripts/regression-snapshot.py          # auto: capture if no snapshot, compare if one exists
"""
from __future__ import annotations

import json
import logging
import sqlite3
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

import click

# ---------------------------------------------------------------------------
# Path setup
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
VIDEO_ML_DIR = PROJECT_ROOT / "video-ml"

# Allow imports from video-ml (e.g. PipelineConfig)
sys.path.insert(0, str(VIDEO_ML_DIR))

FILM_DB_PATH = PROJECT_ROOT / "data" / "film.db"
BASKETBALL_DB_PATH = PROJECT_ROOT / "data" / "basketball.db"
SNAPSHOT_PATH = PROJECT_ROOT / "data" / "regression-snapshot.json"

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Immutable data containers
# ---------------------------------------------------------------------------

FILM_COUNT_TABLES = ("videos", "clips", "tags", "clip_tags", "processing_jobs")
BASKETBALL_COUNT_TABLES = (
    "players",
    "shots",
    "player_game_logs",
    "teams",
    "standings",
)


@dataclass(frozen=True)
class DbSnapshot:
    """Immutable snapshot of a single database."""

    counts: dict[str, int]
    unique_values: dict[str, list[str]]


@dataclass(frozen=True)
class FullSnapshot:
    """Immutable snapshot of both databases."""

    timestamp: str
    film: DbSnapshot
    basketball: DbSnapshot


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------


_ALLOWED_TABLES = frozenset(FILM_COUNT_TABLES) | frozenset(BASKETBALL_COUNT_TABLES)
_ALLOWED_COLUMNS = frozenset({"play_type", "primary_action"})


def _safe_count(conn: sqlite3.Connection, table: str) -> int:
    """Return row count for *table*, or -1 if the table does not exist."""
    if table not in _ALLOWED_TABLES:
        raise ValueError(f"Table not in allowlist: {table}")
    try:
        row = conn.execute(f"SELECT COUNT(*) FROM [{table}]").fetchone()
        return row[0] if row else -1
    except sqlite3.OperationalError:
        return -1


def _safe_unique(conn: sqlite3.Connection, table: str, column: str) -> list[str]:
    """Return sorted unique non-null values for *column* in *table*."""
    if table not in _ALLOWED_TABLES:
        raise ValueError(f"Table not in allowlist: {table}")
    if column not in _ALLOWED_COLUMNS:
        raise ValueError(f"Column not in allowlist: {column}")
    try:
        rows = conn.execute(
            f"SELECT DISTINCT [{column}] FROM [{table}] WHERE [{column}] IS NOT NULL ORDER BY [{column}]"
        ).fetchall()
        return [str(r[0]) for r in rows]
    except sqlite3.OperationalError:
        return []


def _capture_film(db_path: Path) -> DbSnapshot:
    """Capture snapshot of film.db."""
    if not db_path.exists():
        log.warning("film.db not found at %s — returning empty snapshot", db_path)
        return DbSnapshot(
            counts={t: -1 for t in FILM_COUNT_TABLES},
            unique_values={"play_types": [], "actions": []},
        )

    conn = sqlite3.connect(str(db_path))
    try:
        counts = {table: _safe_count(conn, table) for table in FILM_COUNT_TABLES}
        unique_values = {
            "play_types": _safe_unique(conn, "clips", "play_type"),
            "actions": _safe_unique(conn, "clips", "primary_action"),
        }
        return DbSnapshot(counts=counts, unique_values=unique_values)
    finally:
        conn.close()


def _capture_basketball(db_path: Path) -> DbSnapshot:
    """Capture snapshot of basketball.db."""
    if not db_path.exists():
        log.warning("basketball.db not found at %s — returning empty snapshot", db_path)
        return DbSnapshot(
            counts={t: -1 for t in BASKETBALL_COUNT_TABLES},
            unique_values={},
        )

    conn = sqlite3.connect(str(db_path))
    try:
        counts = {table: _safe_count(conn, table) for table in BASKETBALL_COUNT_TABLES}
        return DbSnapshot(counts=counts, unique_values={})
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Serialisation (immutable — always return new dicts)
# ---------------------------------------------------------------------------


def _snapshot_to_dict(snapshot: FullSnapshot) -> dict[str, Any]:
    return {
        "timestamp": snapshot.timestamp,
        "film": {
            "counts": dict(snapshot.film.counts),
            "unique_values": {k: list(v) for k, v in snapshot.film.unique_values.items()},
        },
        "basketball": {
            "counts": dict(snapshot.basketball.counts),
            "unique_values": {k: list(v) for k, v in snapshot.basketball.unique_values.items()},
        },
    }


def _dict_to_snapshot(data: dict[str, Any]) -> FullSnapshot:
    film_data = data.get("film", {})
    bball_data = data.get("basketball", {})
    return FullSnapshot(
        timestamp=data.get("timestamp", ""),
        film=DbSnapshot(
            counts=film_data.get("counts", {}),
            unique_values=film_data.get("unique_values", {}),
        ),
        basketball=DbSnapshot(
            counts=bball_data.get("counts", {}),
            unique_values=bball_data.get("unique_values", {}),
        ),
    )


# ---------------------------------------------------------------------------
# Capture
# ---------------------------------------------------------------------------


def capture_snapshot(
    film_db: Path = FILM_DB_PATH,
    basketball_db: Path = BASKETBALL_DB_PATH,
) -> FullSnapshot:
    """Build an immutable snapshot of both databases."""
    return FullSnapshot(
        timestamp=datetime.now().isoformat(),
        film=_capture_film(film_db),
        basketball=_capture_basketball(basketball_db),
    )


def save_snapshot(snapshot: FullSnapshot, path: Path = SNAPSHOT_PATH) -> None:
    """Serialise *snapshot* to JSON at *path*."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(_snapshot_to_dict(snapshot), indent=2))
    log.info("Snapshot saved to %s", path)


def load_snapshot(path: Path = SNAPSHOT_PATH) -> FullSnapshot:
    """Load a snapshot from *path*."""
    data = json.loads(path.read_text())
    return _dict_to_snapshot(data)


# ---------------------------------------------------------------------------
# Compare
# ---------------------------------------------------------------------------


def _format_delta(old: int, new: int) -> str:
    """Return a human-readable delta string."""
    diff = new - old
    if diff == 0:
        return "(no change)"
    sign = "+" if diff > 0 else ""
    return f"({sign}{diff})"


def compare_snapshots(
    baseline: FullSnapshot,
    current: FullSnapshot,
) -> bool:
    """Print comparison report. Returns True when no regressions found."""
    regressions: list[str] = []

    print()
    print("Regression Snapshot Comparison")
    print("=" * 40)

    # --- film.db counts ---
    print("film.db:")
    for table in FILM_COUNT_TABLES:
        old_val = baseline.film.counts.get(table, -1)
        new_val = current.film.counts.get(table, -1)
        delta = _format_delta(old_val, new_val)
        print(f"  {table}: {old_val} -> {new_val} {delta}")
        if new_val < old_val and old_val >= 0 and new_val >= 0:
            msg = f"WARNING: {table} decreased from {old_val} -> {new_val} ({new_val - old_val}) — possible regression!"
            regressions.append(msg)
            print(f"  {msg}")

    # --- film.db unique values ---
    for key in ("play_types", "actions"):
        old_set = set(baseline.film.unique_values.get(key, []))
        new_set = set(current.film.unique_values.get(key, []))
        added = sorted(new_set - old_set)
        removed = sorted(old_set - new_set)
        if added:
            print(f"  {key} added: {added}")
        if removed:
            msg = f"WARNING: {key} removed: {removed} — possible regression!"
            regressions.append(msg)
            print(f"  {msg}")
        if not added and not removed:
            print(f"  {key}: unchanged ({len(new_set)} values)")

    # --- basketball.db counts ---
    print("basketball.db:")
    for table in BASKETBALL_COUNT_TABLES:
        old_val = baseline.basketball.counts.get(table, -1)
        new_val = current.basketball.counts.get(table, -1)
        delta = _format_delta(old_val, new_val)
        print(f"  {table}: {old_val} -> {new_val} {delta}")
        if new_val < old_val and old_val >= 0 and new_val >= 0:
            msg = f"WARNING: {table} decreased from {old_val} -> {new_val} ({new_val - old_val}) — possible regression!"
            regressions.append(msg)
            print(f"  {msg}")

    # --- Verdict ---
    print()
    if regressions:
        print("Result: REGRESSIONS DETECTED")
        for r in regressions:
            print(f"  {r}")
        return False

    print("Result: NO REGRESSIONS (all counts stable or growing)")
    return True


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


@click.command()
@click.option("--capture", "mode", flag_value="capture", help="Capture a new snapshot.")
@click.option("--compare", "mode", flag_value="compare", help="Compare current state against saved snapshot.")
@click.option(
    "--snapshot-path",
    type=click.Path(path_type=Path),
    default=str(SNAPSHOT_PATH),
    show_default=True,
    help="Path for the snapshot JSON file.",
)
@click.option(
    "--film-db",
    type=click.Path(path_type=Path),
    default=str(FILM_DB_PATH),
    show_default=True,
    help="Path to film.db.",
)
@click.option(
    "--basketball-db",
    type=click.Path(path_type=Path),
    default=str(BASKETBALL_DB_PATH),
    show_default=True,
    help="Path to basketball.db.",
)
def main(
    mode: str | None,
    snapshot_path: Path,
    film_db: Path,
    basketball_db: Path,
) -> None:
    """Capture and compare regression snapshots for film.db and basketball.db."""
    # Default mode: capture if no snapshot, compare if one exists.
    if mode is None:
        mode = "compare" if snapshot_path.exists() else "capture"
        log.info("Auto-detected mode: %s", mode)

    if mode == "capture":
        snapshot = capture_snapshot(film_db=film_db, basketball_db=basketball_db)
        save_snapshot(snapshot, path=snapshot_path)
        print()
        print("Captured snapshot:")
        print(f"  timestamp: {snapshot.timestamp}")
        print("  film.db counts:")
        for table, count in snapshot.film.counts.items():
            print(f"    {table}: {count}")
        for key, values in snapshot.film.unique_values.items():
            print(f"    {key}: {values}")
        print("  basketball.db counts:")
        for table, count in snapshot.basketball.counts.items():
            print(f"    {table}: {count}")
        sys.exit(0)

    # mode == "compare"
    if not snapshot_path.exists():
        log.error("No snapshot found at %s. Run with --capture first.", snapshot_path)
        sys.exit(1)

    baseline = load_snapshot(snapshot_path)
    current = capture_snapshot(film_db=film_db, basketball_db=basketball_db)
    passed = compare_snapshots(baseline, current)
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
