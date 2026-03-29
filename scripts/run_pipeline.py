#!/usr/bin/env python3
"""
Pipeline orchestrator — runs ingest -> validate -> snapshot in sequence.

Usage:
    # Full pipeline (ingest all 18 new tables + validate + snapshot)
    python scripts/run_pipeline.py

    # Only specific tier
    python scripts/run_pipeline.py --tier 1

    # Only specific table
    python scripts/run_pipeline.py --table player_stats_per100poss

    # Skip ingestion, just validate + snapshot
    python scripts/run_pipeline.py --validate-only

    # Custom paths
    python scripts/run_pipeline.py --data-dir /path/to/csvs --db-path /path/to/db
"""
from __future__ import annotations

import argparse
import sqlite3
import sys
import time
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent

# Add project paths for imports
sys.path.insert(0, str(SCRIPT_DIR))
sys.path.insert(0, str(PROJECT_DIR / "src" / "scripts"))

from pipeline_config import (
    ALL_NEW_TABLES,
    DEFAULT_DATA_DIR,
    DEFAULT_DB_PATH,
    TABLE_REGISTRY,
)
from validate import run_validation, print_report
from regression_snapshot import take_snapshot, save_snapshot, SNAPSHOT_DIR


def elapsed(start: float) -> str:
    secs = time.time() - start
    if secs < 60:
        return f"{secs:.1f}s"
    return f"{secs / 60:.1f}m"


def run_ingestion(
    data_dir: Path,
    db_path: Path,
    *,
    tier_filter: int | None = None,
    table_filter: str | None = None,
) -> None:
    """Run the ingestion step."""
    # Import the ingestion functions from the main pipeline
    # We need to import dynamically since the file has a hyphen in its name
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "ingest_basketball_data",
        str(PROJECT_DIR / "src" / "scripts" / "ingest-basketball-data.py"),
    )
    if spec is None or spec.loader is None:
        print("ERROR: Could not load ingest-basketball-data.py")
        sys.exit(1)

    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    conn.execute("PRAGMA cache_size = -65536")
    conn.execute("PRAGMA temp_store = MEMORY")

    try:
        if table_filter:
            # Ingest a single table
            func_name = f"build_{table_filter}"
            func = getattr(mod, func_name, None)
            if func is None:
                print(f"ERROR: No function '{func_name}' found in pipeline")
                sys.exit(1)
            func(conn, data_dir)
        elif tier_filter is not None:
            # Ingest tables from a specific tier
            tier_tables = [t for t in ALL_NEW_TABLES if t.tier == tier_filter]
            for table_spec in tier_tables:
                func_name = f"build_{table_spec.name}"
                func = getattr(mod, func_name, None)
                if func:
                    func(conn, data_dir)
                else:
                    print(f"  WARN: No function for {table_spec.name}")
        else:
            # Ingest all 18 new tables
            mod.build_all_new_tables(conn, data_dir)
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Pipeline orchestrator: ingest -> validate -> snapshot"
    )
    parser.add_argument(
        "--data-dir", type=Path, default=DEFAULT_DATA_DIR,
        help=f"Root data directory (default: {DEFAULT_DATA_DIR})",
    )
    parser.add_argument(
        "--db-path", type=Path, default=DEFAULT_DB_PATH,
        help=f"SQLite database path (default: {DEFAULT_DB_PATH})",
    )
    parser.add_argument(
        "--tier", type=int, default=None, choices=[1, 2, 3],
        help="Only process tables from a specific tier",
    )
    parser.add_argument(
        "--table", type=str, default=None,
        help="Only process a specific table",
    )
    parser.add_argument(
        "--validate-only", action="store_true",
        help="Skip ingestion, only run validation and snapshot",
    )
    parser.add_argument(
        "--skip-validate", action="store_true",
        help="Skip validation step",
    )
    parser.add_argument(
        "--skip-snapshot", action="store_true",
        help="Skip snapshot step",
    )
    args = parser.parse_args()

    overall_start = time.time()

    print("=" * 70)
    print("BASKETBALL INTELLIGENCE PIPELINE ORCHESTRATOR")
    print("=" * 70)
    print(f"  Data dir : {args.data_dir}")
    print(f"  DB path  : {args.db_path}")
    print()

    # ── Step 1: Ingestion ────────────────────────────────────────────────
    if not args.validate_only:
        print("\n--- STEP 1: INGESTION ---")
        t0 = time.time()
        run_ingestion(
            args.data_dir,
            args.db_path,
            tier_filter=args.tier,
            table_filter=args.table,
        )
        print(f"\n  Ingestion complete ({elapsed(t0)})")
    else:
        print("\n--- STEP 1: INGESTION (skipped) ---")

    # ── Step 2: Validation ───────────────────────────────────────────────
    if not args.skip_validate:
        print("\n--- STEP 2: VALIDATION ---")
        t0 = time.time()
        report = run_validation(
            args.db_path,
            table_filter=args.table,
            tier_filter=args.tier,
        )
        print_report(report)
        print(f"  Validation complete ({elapsed(t0)})")
    else:
        print("\n--- STEP 2: VALIDATION (skipped) ---")
        report = None

    # ── Step 3: Snapshot ─────────────────────────────────────────────────
    if not args.skip_snapshot:
        print("\n--- STEP 3: SNAPSHOT ---")
        t0 = time.time()
        snapshot = take_snapshot(args.db_path)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = SNAPSHOT_DIR / f"snapshot_{ts}.json"
        save_snapshot(snapshot, output_path)
        print(f"  Snapshot complete ({elapsed(t0)})")
    else:
        print("\n--- STEP 3: SNAPSHOT (skipped) ---")

    # ── Summary ──────────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print(f"PIPELINE COMPLETE ({elapsed(overall_start)})")
    if report and not report.passed:
        print(f"  WARNING: {report.error_count} validation error(s)")
        sys.exit(1)
    print("=" * 70)


if __name__ == "__main__":
    main()
