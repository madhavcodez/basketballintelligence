#!/usr/bin/env python3
"""
Basketball Intelligence Playground - Database Verification

Checks the SQLite database was created correctly by printing table names,
row counts, column info, and sample rows from each table.
"""

import os
import sqlite3
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
DB_PATH = os.path.join(PROJECT_DIR, "data", "basketball.db")


def print_separator(char: str = "-", width: int = 70) -> None:
    print(char * width)


def verify_database() -> None:
    if not os.path.exists(DB_PATH):
        print(f"ERROR: Database not found at {DB_PATH}")
        print("Run scripts/ingest.py first to create the database.")
        sys.exit(1)

    db_size_mb = os.path.getsize(DB_PATH) / (1024 * 1024)
    print(f"Database: {DB_PATH}")
    print(f"Size:     {db_size_mb:.1f} MB")
    print()

    conn = sqlite3.connect(DB_PATH)
    try:
        conn.row_factory = sqlite3.Row

        # Get all tables
        tables = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        ).fetchall()
        table_names = [t["name"] for t in tables]

        print(f"Tables found: {len(table_names)}")
        print_separator("=")

    total_rows = 0

    for table_name in table_names:
        # Row count
        row_count = conn.execute(f'SELECT COUNT(*) AS cnt FROM "{table_name}"').fetchone()["cnt"]
        total_rows += row_count

        # Column info
        col_info = conn.execute(f'PRAGMA table_info("{table_name}")').fetchall()
        columns = [c["name"] for c in col_info]

        # Indexes
        indexes = conn.execute(
            f'PRAGMA index_list("{table_name}")'
        ).fetchall()
        index_names = [idx["name"] for idx in indexes]

        print(f"\nTable: {table_name}")
        print(f"  Rows:    {row_count:,}")
        print(f"  Columns: {len(columns)}")
        print(f"    {', '.join(columns)}")
        if index_names:
            print(f"  Indexes: {', '.join(index_names)}")
        else:
            print("  Indexes: (none)")

        # Sample rows (first 3)
        sample = conn.execute(f'SELECT * FROM "{table_name}" LIMIT 3').fetchall()
        if sample:
            print("  Sample rows:")
            for row in sample:
                row_dict = dict(row)
                # Truncate long values for display
                display_items = []
                for k, v in row_dict.items():
                    v_str = str(v) if v is not None else "NULL"
                    if len(v_str) > 40:
                        v_str = v_str[:37] + "..."
                    display_items.append(f"{k}={v_str}")
                print(f"    {{ {', '.join(display_items)} }}")

        print_separator()

    print(f"\nTotal rows across all tables: {total_rows:,}")

    # Expected tables check
    expected_tables = [
        # Original 13 tables
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
        # New 18 tables (Tier 1: BBRef multi-season)
        "player_stats_per100poss",
        "player_stats_per36min",
        "player_stats_totals",
        "player_stats_playoffs_pergame_bbref",
        "player_shooting_splits",
        # New 18 tables (Tier 2: Enrichment)
        "all_nba_teams",
        "all_defense_teams",
        "all_star_selections_new",
        "awards_major",
        "contracts",
        "draft_combine",
        "team_four_factors",
        "team_opponent_pergame",
        "player_stats_defense_new",
        "player_stats_scoring_new",
        "player_stats_usage_new",
        # New 18 tables (Tier 3: Playoff extended)
        "playoff_game_logs",
        "injury_history",
    ]

    print("\nExpected tables check:")
    all_present = True
    for t in expected_tables:
        present = t in table_names
        status = "OK" if present else "MISSING"
        if not present:
            all_present = False
        print(f"  [{status}] {t}")

    if all_present:
        print("\nAll expected tables are present.")
    else:
        print("\nWARNING: Some expected tables are missing!")

    finally:
        conn.close()


if __name__ == "__main__":
    verify_database()
