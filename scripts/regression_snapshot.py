#!/usr/bin/env python3
"""
Regression snapshot system for basketball.db.

Takes a snapshot of 20 sentinel queries, saves to JSON, and compares
against future snapshots to detect regressions.

Usage:
    # Take a snapshot
    python scripts/regression_snapshot.py snapshot
    python scripts/regression_snapshot.py snapshot --output my_snapshot.json

    # Compare two snapshots
    python scripts/regression_snapshot.py compare baseline.json current.json

    # Take snapshot and compare against latest baseline
    python scripts/regression_snapshot.py check
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_DB_PATH = SCRIPT_DIR.parent / "data" / "basketball.db"
SNAPSHOT_DIR = SCRIPT_DIR.parent / "data" / "snapshots"


# ── Sentinel Queries ─────────────────────────────────────────────────────────
# 20 queries that cover key data integrity invariants.

SENTINEL_QUERIES: list[dict[str, str]] = [
    # 1. Total player count
    {
        "id": "total_players",
        "description": "Total rows in players table",
        "sql": "SELECT COUNT(*) as value FROM players",
    },
    # 2. Total per-game stats
    {
        "id": "total_pergame_stats",
        "description": "Total rows in player_stats_pergame",
        "sql": "SELECT COUNT(*) as value FROM player_stats_pergame",
    },
    # 3. Total shots
    {
        "id": "total_shots",
        "description": "Total rows in shots",
        "sql": "SELECT COUNT(*) as value FROM shots",
    },
    # 4. LeBron career seasons count
    {
        "id": "lebron_seasons",
        "description": "LeBron James season count in pergame",
        "sql": "SELECT COUNT(*) as value FROM player_stats_pergame WHERE Player LIKE '%LeBron%'",
    },
    # 5. Distinct seasons in pergame
    {
        "id": "distinct_seasons_pergame",
        "description": "Distinct seasons in player_stats_pergame",
        "sql": "SELECT COUNT(DISTINCT Season) as value FROM player_stats_pergame",
    },
    # 6. Total per-100 poss rows
    {
        "id": "total_per100poss",
        "description": "Total rows in player_stats_per100poss",
        "sql": "SELECT COUNT(*) as value FROM player_stats_per100poss",
    },
    # 7. Total per-36 min rows
    {
        "id": "total_per36min",
        "description": "Total rows in player_stats_per36min",
        "sql": "SELECT COUNT(*) as value FROM player_stats_per36min",
    },
    # 8. Total totals rows
    {
        "id": "total_totals",
        "description": "Total rows in player_stats_totals",
        "sql": "SELECT COUNT(*) as value FROM player_stats_totals",
    },
    # 9. Shooting splits row count
    {
        "id": "total_shooting_splits",
        "description": "Total rows in player_shooting_splits",
        "sql": "SELECT COUNT(*) as value FROM player_shooting_splits",
    },
    # 10. All-NBA selections count
    {
        "id": "total_all_nba",
        "description": "Total rows in all_nba_teams",
        "sql": "SELECT COUNT(*) as value FROM all_nba_teams",
    },
    # 11. All-Defense count
    {
        "id": "total_all_defense",
        "description": "Total rows in all_defense_teams",
        "sql": "SELECT COUNT(*) as value FROM all_defense_teams",
    },
    # 12. Awards major count
    {
        "id": "total_awards_major",
        "description": "Total rows in awards_major",
        "sql": "SELECT COUNT(*) as value FROM awards_major",
    },
    # 13. Contracts count
    {
        "id": "total_contracts",
        "description": "Total rows in contracts",
        "sql": "SELECT COUNT(*) as value FROM contracts",
    },
    # 14. Draft combine count
    {
        "id": "total_draft_combine",
        "description": "Total rows in draft_combine",
        "sql": "SELECT COUNT(*) as value FROM draft_combine",
    },
    # 15. Team four factors count
    {
        "id": "total_team_four_factors",
        "description": "Total rows in team_four_factors",
        "sql": "SELECT COUNT(*) as value FROM team_four_factors",
    },
    # 16. Injury history count
    {
        "id": "total_injury_history",
        "description": "Total rows in injury_history",
        "sql": "SELECT COUNT(*) as value FROM injury_history",
    },
    # 17. Playoff game logs count
    {
        "id": "total_playoff_game_logs",
        "description": "Total rows in playoff_game_logs",
        "sql": "SELECT COUNT(*) as value FROM playoff_game_logs",
    },
    # 18. Total tables in DB
    {
        "id": "total_tables",
        "description": "Total number of tables in database",
        "sql": "SELECT COUNT(*) as value FROM sqlite_master WHERE type='table'",
    },
    # 19. Standings seasons
    {
        "id": "distinct_seasons_standings",
        "description": "Distinct seasons in standings",
        "sql": "SELECT COUNT(DISTINCT Season) as value FROM standings",
    },
    # 20. Career leaders stat categories
    {
        "id": "career_leader_categories",
        "description": "Distinct stat categories in career_leaders",
        "sql": "SELECT COUNT(DISTINCT stat) as value FROM career_leaders",
    },
]


# ── Snapshot ─────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class SnapshotEntry:
    """Immutable result of a single sentinel query."""
    query_id: str
    description: str
    value: Any
    error: Optional[str] = None


@dataclass(frozen=True)
class Snapshot:
    """Immutable snapshot of all sentinel query results."""
    timestamp: str
    db_path: str
    entries: tuple[SnapshotEntry, ...]

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp,
            "db_path": self.db_path,
            "entries": {
                e.query_id: {
                    "description": e.description,
                    "value": e.value,
                    "error": e.error,
                }
                for e in self.entries
            },
        }

    @staticmethod
    def from_dict(data: dict) -> "Snapshot":
        entries = tuple(
            SnapshotEntry(
                query_id=qid,
                description=info["description"],
                value=info["value"],
                error=info.get("error"),
            )
            for qid, info in data["entries"].items()
        )
        return Snapshot(
            timestamp=data["timestamp"],
            db_path=data["db_path"],
            entries=entries,
        )


def take_snapshot(db_path: Path) -> Snapshot:
    """Execute all sentinel queries and return a Snapshot."""
    conn = sqlite3.connect(str(db_path))
    entries: list[SnapshotEntry] = []

    try:
        for q in SENTINEL_QUERIES:
            try:
                row = conn.execute(q["sql"]).fetchone()
                value = row[0] if row else None
                entries.append(SnapshotEntry(
                    query_id=q["id"],
                    description=q["description"],
                    value=value,
                ))
            except sqlite3.OperationalError as e:
                entries.append(SnapshotEntry(
                    query_id=q["id"],
                    description=q["description"],
                    value=None,
                    error=str(e),
                ))
    finally:
        conn.close()

    return Snapshot(
        timestamp=datetime.now().isoformat(),
        db_path=str(db_path),
        entries=tuple(entries),
    )


def save_snapshot(snapshot: Snapshot, output_path: Path) -> None:
    """Save a snapshot to a JSON file."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(snapshot.to_dict(), f, indent=2)
    print(f"Snapshot saved to {output_path}")


def load_snapshot(path: Path) -> Snapshot:
    """Load a snapshot from a JSON file."""
    with open(path, "r") as f:
        return Snapshot.from_dict(json.load(f))


# ── Comparison ───────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class ComparisonResult:
    """Immutable comparison of two snapshot entries."""
    query_id: str
    description: str
    baseline_value: Any
    current_value: Any
    regression: bool
    change_pct: Optional[float] = None
    note: str = ""


def compare_snapshots(
    baseline: Snapshot,
    current: Snapshot,
    *,
    tolerance_pct: float = 5.0,
) -> list[ComparisonResult]:
    """Compare two snapshots, flagging regressions beyond tolerance."""
    baseline_map = {e.query_id: e for e in baseline.entries}
    results: list[ComparisonResult] = []

    for entry in current.entries:
        base = baseline_map.get(entry.query_id)
        if base is None:
            results.append(ComparisonResult(
                query_id=entry.query_id,
                description=entry.description,
                baseline_value=None,
                current_value=entry.value,
                regression=False,
                note="New query (no baseline)",
            ))
            continue

        if entry.error and base.error:
            # Both errored — not a regression (consistently missing)
            results.append(ComparisonResult(
                query_id=entry.query_id,
                description=entry.description,
                baseline_value=None,
                current_value=None,
                regression=False,
                note=f"Both errored: {entry.error}",
            ))
            continue

        if entry.error:
            results.append(ComparisonResult(
                query_id=entry.query_id,
                description=entry.description,
                baseline_value=base.value,
                current_value=None,
                regression=True,
                note=f"Query error: {entry.error}",
            ))
            continue

        if base.error:
            results.append(ComparisonResult(
                query_id=entry.query_id,
                description=entry.description,
                baseline_value=None,
                current_value=entry.value,
                regression=False,
                note="Previously errored, now resolved",
            ))
            continue

        # Numeric comparison
        if isinstance(base.value, (int, float)) and isinstance(entry.value, (int, float)):
            if base.value == 0:
                change_pct = 100.0 if entry.value != 0 else 0.0
            else:
                change_pct = ((entry.value - base.value) / abs(base.value)) * 100

            # Regression = data loss (negative change beyond tolerance)
            regression = change_pct < -tolerance_pct
            results.append(ComparisonResult(
                query_id=entry.query_id,
                description=entry.description,
                baseline_value=base.value,
                current_value=entry.value,
                regression=regression,
                change_pct=change_pct,
                note=f"{change_pct:+.1f}%" if change_pct != 0 else "unchanged",
            ))
        else:
            results.append(ComparisonResult(
                query_id=entry.query_id,
                description=entry.description,
                baseline_value=base.value,
                current_value=entry.value,
                regression=base.value != entry.value,
                note="changed" if base.value != entry.value else "unchanged",
            ))

    return results


def print_comparison(results: list[ComparisonResult]) -> bool:
    """Print comparison results. Returns True if no regressions."""
    print("=" * 70)
    print("REGRESSION COMPARISON")
    print("=" * 70)

    regressions = 0
    for r in results:
        icon = "OK" if not r.regression else "!!"
        baseline_str = f"{r.baseline_value:,}" if isinstance(r.baseline_value, int) else str(r.baseline_value)
        current_str = f"{r.current_value:,}" if isinstance(r.current_value, int) else str(r.current_value)

        print(f"  [{icon}] {r.query_id:35s} {baseline_str:>12s} -> {current_str:>12s}  {r.note}")
        if r.regression:
            regressions += 1

    print("\n" + "-" * 70)
    if regressions == 0:
        print(f"  PASS: No regressions detected ({len(results)} queries checked)")
    else:
        print(f"  FAIL: {regressions} regression(s) detected!")
    print("=" * 70)

    return regressions == 0


# ── CLI ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Regression snapshot system")
    subparsers = parser.add_subparsers(dest="command", help="Command")

    # snapshot
    snap_parser = subparsers.add_parser("snapshot", help="Take a new snapshot")
    snap_parser.add_argument("--db-path", type=Path, default=DEFAULT_DB_PATH)
    snap_parser.add_argument(
        "--output", type=Path, default=None,
        help="Output file (default: data/snapshots/snapshot_YYYYMMDD_HHMMSS.json)",
    )

    # compare
    cmp_parser = subparsers.add_parser("compare", help="Compare two snapshots")
    cmp_parser.add_argument("baseline", type=Path, help="Baseline snapshot JSON")
    cmp_parser.add_argument("current", type=Path, help="Current snapshot JSON")
    cmp_parser.add_argument(
        "--tolerance", type=float, default=5.0,
        help="Tolerance percentage for regression detection (default: 5.0)",
    )

    # check
    chk_parser = subparsers.add_parser(
        "check", help="Take snapshot and compare against latest baseline"
    )
    chk_parser.add_argument("--db-path", type=Path, default=DEFAULT_DB_PATH)
    chk_parser.add_argument("--tolerance", type=float, default=5.0)

    args = parser.parse_args()

    if args.command == "snapshot":
        snapshot = take_snapshot(args.db_path)
        if args.output:
            output_path = args.output
        else:
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = SNAPSHOT_DIR / f"snapshot_{ts}.json"
        save_snapshot(snapshot, output_path)

        # Print summary
        for e in snapshot.entries:
            status = "ERR" if e.error else "OK "
            val = f"{e.value:,}" if isinstance(e.value, int) else str(e.value)
            print(f"  [{status}] {e.query_id:35s} {val}")

    elif args.command == "compare":
        baseline = load_snapshot(args.baseline)
        current = load_snapshot(args.current)
        results = compare_snapshots(baseline, current, tolerance_pct=args.tolerance)
        passed = print_comparison(results)
        sys.exit(0 if passed else 1)

    elif args.command == "check":
        # Find latest baseline
        SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
        existing = sorted(SNAPSHOT_DIR.glob("snapshot_*.json"))

        # Take current snapshot
        current = take_snapshot(args.db_path)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        current_path = SNAPSHOT_DIR / f"snapshot_{ts}.json"
        save_snapshot(current, current_path)

        if not existing:
            print("\nNo previous baseline found. Current snapshot saved as baseline.")
            sys.exit(0)

        baseline = load_snapshot(existing[-1])
        results = compare_snapshots(baseline, current, tolerance_pct=args.tolerance)
        passed = print_comparison(results)
        sys.exit(0 if passed else 1)

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
