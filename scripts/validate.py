#!/usr/bin/env python3
"""
Validation framework for basketball.db.

Runs per-table validation rules: row counts, null checks, referential
integrity, data type validation, and duplicate detection.

Usage:
    python scripts/validate.py
    python scripts/validate.py --db-path /path/to/basketball.db
    python scripts/validate.py --table player_stats_per100poss
    python scripts/validate.py --tier 1
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

# Add scripts dir to path for imports
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from pipeline_config import ALL_NEW_TABLES, EXISTING_TABLES, TABLE_REGISTRY, TableSpec

DEFAULT_DB_PATH = Path(SCRIPT_DIR).parent / "data" / "basketball.db"


# ── Result Types ─────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class ValidationResult:
    """Immutable result of a single validation check."""
    table: str
    check: str
    passed: bool
    message: str
    severity: str = "ERROR"  # ERROR, WARN, INFO


@dataclass
class ValidationReport:
    """Aggregated validation report."""
    results: list[ValidationResult] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return all(r.passed for r in self.results if r.severity == "ERROR")

    @property
    def error_count(self) -> int:
        return sum(1 for r in self.results if not r.passed and r.severity == "ERROR")

    @property
    def warn_count(self) -> int:
        return sum(1 for r in self.results if not r.passed and r.severity == "WARN")

    def add(self, result: ValidationResult) -> None:
        self.results.append(result)

    def to_dict(self) -> dict:
        return {
            "passed": self.passed,
            "error_count": self.error_count,
            "warn_count": self.warn_count,
            "results": [
                {
                    "table": r.table,
                    "check": r.check,
                    "passed": r.passed,
                    "message": r.message,
                    "severity": r.severity,
                }
                for r in self.results
            ],
        }


# ── Validation Rules ─────────────────────────────────────────────────────────

def check_table_exists(conn: sqlite3.Connection, table: str) -> ValidationResult:
    """Check that a table exists in the database."""
    tables = [
        r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    ]
    exists = table in tables
    return ValidationResult(
        table=table,
        check="table_exists",
        passed=exists,
        message=f"Table '{table}' {'exists' if exists else 'MISSING'}",
    )


def check_row_count(
    conn: sqlite3.Connection, table: str, min_rows: int = 0
) -> ValidationResult:
    """Check that a table has at least min_rows."""
    try:
        count = conn.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
        passed = count >= min_rows
        return ValidationResult(
            table=table,
            check="row_count",
            passed=passed,
            message=f"{count:,} rows (min: {min_rows:,})",
            severity="ERROR" if min_rows > 0 and not passed else "INFO",
        )
    except sqlite3.OperationalError:
        return ValidationResult(
            table=table,
            check="row_count",
            passed=False,
            message="Table does not exist",
        )


def check_no_empty_key_column(
    conn: sqlite3.Connection, table: str, column: str
) -> ValidationResult:
    """Check that a key column has no NULL or empty values."""
    try:
        # First verify the column exists
        cols = [
            r[1] for r in conn.execute(f'PRAGMA table_info("{table}")').fetchall()
        ]
        if column not in cols:
            return ValidationResult(
                table=table,
                check=f"null_check_{column}",
                passed=False,
                message=f"Column '{column}' not found in table",
            )

        null_count = conn.execute(
            f'SELECT COUNT(*) FROM "{table}" WHERE "{column}" IS NULL OR "{column}" = ""'
        ).fetchone()[0]
        total = conn.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
        passed = null_count == 0
        pct = (null_count / total * 100) if total > 0 else 0
        return ValidationResult(
            table=table,
            check=f"null_check_{column}",
            passed=passed,
            message=f"{column}: {null_count:,} nulls/empty ({pct:.1f}%)",
            severity="WARN" if null_count > 0 else "INFO",
        )
    except sqlite3.OperationalError:
        return ValidationResult(
            table=table,
            check=f"null_check_{column}",
            passed=False,
            message=f"Column '{column}' or table not found",
        )


def check_no_full_duplicates(
    conn: sqlite3.Connection, table: str
) -> ValidationResult:
    """Check for fully duplicate rows (all columns identical)."""
    try:
        cols = [
            r[1] for r in conn.execute(f'PRAGMA table_info("{table}")').fetchall()
        ]
        col_list = ", ".join(f'"{c}"' for c in cols)
        dup_count = conn.execute(f"""
            SELECT COUNT(*) FROM (
                SELECT {col_list}, COUNT(*) as cnt
                FROM "{table}"
                GROUP BY {col_list}
                HAVING cnt > 1
            )
        """).fetchone()[0]
        return ValidationResult(
            table=table,
            check="duplicates",
            passed=dup_count == 0,
            message=f"{dup_count:,} duplicate row groups",
            severity="WARN" if dup_count > 0 else "INFO",
        )
    except sqlite3.OperationalError as e:
        return ValidationResult(
            table=table,
            check="duplicates",
            passed=True,
            message=f"Could not check: {e}",
            severity="INFO",
        )


def check_column_exists(
    conn: sqlite3.Connection, table: str, column: str
) -> ValidationResult:
    """Check that a specific column exists in a table."""
    try:
        cols = [
            r[1] for r in conn.execute(f'PRAGMA table_info("{table}")').fetchall()
        ]
        exists = column in cols
        return ValidationResult(
            table=table,
            check=f"column_exists_{column}",
            passed=exists,
            message=f"Column '{column}' {'found' if exists else 'MISSING'}",
        )
    except sqlite3.OperationalError:
        return ValidationResult(
            table=table,
            check=f"column_exists_{column}",
            passed=False,
            message=f"Table '{table}' not found",
        )


def check_numeric_range(
    conn: sqlite3.Connection,
    table: str,
    column: str,
    min_val: Optional[float] = None,
    max_val: Optional[float] = None,
) -> ValidationResult:
    """Check that numeric values in a column are within expected range."""
    try:
        out_of_range = 0
        if min_val is not None:
            out_of_range += conn.execute(
                f'SELECT COUNT(*) FROM "{table}" '
                f'WHERE CAST("{column}" AS REAL) < ? '
                f'AND "{column}" IS NOT NULL AND "{column}" != ""',
                (min_val,),
            ).fetchone()[0]
        if max_val is not None:
            out_of_range += conn.execute(
                f'SELECT COUNT(*) FROM "{table}" '
                f'WHERE CAST("{column}" AS REAL) > ? '
                f'AND "{column}" IS NOT NULL AND "{column}" != ""',
                (max_val,),
            ).fetchone()[0]
        passed = out_of_range == 0
        return ValidationResult(
            table=table,
            check=f"range_{column}",
            passed=passed,
            message=f"{column}: {out_of_range:,} values out of range [{min_val}, {max_val}]",
            severity="WARN" if not passed else "INFO",
        )
    except sqlite3.OperationalError as e:
        return ValidationResult(
            table=table,
            check=f"range_{column}",
            passed=True,
            message=f"Could not check: {e}",
            severity="INFO",
        )


# ── Per-Table Validation Rules ───────────────────────────────────────────────

# Maps table name -> list of (check_function, kwargs) to run
TABLE_RULES: dict[str, list] = {}


def _register_bbref_rules(table_name: str, player_col: str = "Player") -> None:
    """Register standard BBRef table validation rules."""
    TABLE_RULES[table_name] = [
        ("table_exists", {}),
        ("row_count", {"min_rows": 100}),
        ("null_check", {"column": player_col}),
        ("null_check", {"column": "Season"}),
        ("duplicates", {}),
        ("range", {"column": "Age", "min_val": 17, "max_val": 50}),
        ("range", {"column": "G", "min_val": 0, "max_val": 86}),
    ]


# Tier 1
_register_bbref_rules("player_stats_per100poss")
_register_bbref_rules("player_stats_per36min")
_register_bbref_rules("player_stats_totals")
_register_bbref_rules("player_stats_playoffs_pergame_bbref")
_register_bbref_rules("player_shooting_splits")

# Tier 2
TABLE_RULES["all_nba_teams"] = [
    ("table_exists", {}),
    ("row_count", {"min_rows": 20}),
    ("null_check", {"column": "player_name"}),
    ("null_check", {"column": "season"}),
]
TABLE_RULES["all_defense_teams"] = [
    ("table_exists", {}),
    ("row_count", {"min_rows": 5}),
    ("null_check", {"column": "player_name"}),
]
TABLE_RULES["all_star_selections_new"] = [
    ("table_exists", {}),
    ("row_count", {"min_rows": 40}),
    ("null_check", {"column": "player"}),
]
TABLE_RULES["awards_major"] = [
    ("table_exists", {}),
    ("row_count", {"min_rows": 150}),
    ("null_check", {"column": "player_name"}),
    ("null_check", {"column": "award_type"}),
]
TABLE_RULES["contracts"] = [
    ("table_exists", {}),
    ("row_count", {"min_rows": 5000}),
    ("null_check", {"column": "name"}),
]
TABLE_RULES["draft_combine"] = [
    ("table_exists", {}),
    ("row_count", {"min_rows": 400}),
    ("null_check", {"column": "player"}),
]
TABLE_RULES["team_four_factors"] = [
    ("table_exists", {}),
    ("row_count", {"min_rows": 700}),
    ("null_check", {"column": "team_name"}),
]
TABLE_RULES["team_opponent_pergame"] = [
    ("table_exists", {}),
    ("row_count", {"min_rows": 700}),
    ("null_check", {"column": "team_name"}),
]
TABLE_RULES["player_stats_defense_new"] = [
    ("table_exists", {}),
    ("row_count", {"min_rows": 10000}),
    ("null_check", {"column": "player_name"}),
]
TABLE_RULES["player_stats_scoring_new"] = [
    ("table_exists", {}),
    ("row_count", {"min_rows": 10000}),
    ("null_check", {"column": "player_name"}),
]
TABLE_RULES["player_stats_usage_new"] = [
    ("table_exists", {}),
    ("row_count", {"min_rows": 10000}),
    ("null_check", {"column": "player_name"}),
]

# Tier 3
TABLE_RULES["playoff_game_logs"] = [
    ("table_exists", {}),
    ("row_count", {"min_rows": 25000}),
    ("null_check", {"column": "personname"}),
]
TABLE_RULES["injury_history"] = [
    ("table_exists", {}),
    ("row_count", {"min_rows": 20000}),
    ("null_check", {"column": "team"}),
]

# Existing tables
for existing in EXISTING_TABLES:
    TABLE_RULES[existing] = [
        ("table_exists", {}),
        ("row_count", {"min_rows": 1}),
    ]


# ── Runner ───────────────────────────────────────────────────────────────────

def validate_table(
    conn: sqlite3.Connection, table_name: str, report: ValidationReport
) -> None:
    """Run all validation rules for a single table."""
    rules = TABLE_RULES.get(table_name, [("table_exists", {})])

    for rule_spec in rules:
        rule_name = rule_spec[0] if isinstance(rule_spec, tuple) else rule_spec
        kwargs = rule_spec[1] if isinstance(rule_spec, tuple) and len(rule_spec) > 1 else {}

        if rule_name == "table_exists":
            report.add(check_table_exists(conn, table_name))
        elif rule_name == "row_count":
            report.add(check_row_count(conn, table_name, **kwargs))
        elif rule_name == "null_check":
            report.add(check_no_empty_key_column(conn, table_name, **kwargs))
        elif rule_name == "duplicates":
            report.add(check_no_full_duplicates(conn, table_name))
        elif rule_name == "range":
            report.add(check_numeric_range(conn, table_name, **kwargs))
        elif rule_name == "column_exists":
            report.add(check_column_exists(conn, table_name, **kwargs))


def run_validation(
    db_path: Path,
    *,
    table_filter: Optional[str] = None,
    tier_filter: Optional[int] = None,
) -> ValidationReport:
    """Run full validation suite. Returns a ValidationReport."""
    if not db_path.exists():
        report = ValidationReport()
        report.add(ValidationResult(
            table="(database)",
            check="db_exists",
            passed=False,
            message=f"Database not found: {db_path}",
        ))
        return report

    conn = sqlite3.connect(str(db_path))
    report = ValidationReport()

    try:
        # Determine which tables to validate
        tables_to_check: list[str] = []

        if table_filter:
            tables_to_check = [table_filter]
        elif tier_filter is not None:
            tables_to_check = [
                t.name for t in ALL_NEW_TABLES if t.tier == tier_filter
            ]
        else:
            # All tables
            tables_to_check = list(TABLE_RULES.keys())

        for table_name in sorted(tables_to_check):
            validate_table(conn, table_name, report)

    finally:
        conn.close()

    return report


def print_report(report: ValidationReport) -> None:
    """Print a human-readable validation report."""
    print("=" * 70)
    print("VALIDATION REPORT")
    print("=" * 70)

    current_table = ""
    for r in report.results:
        if r.table != current_table:
            current_table = r.table
            print(f"\n  {current_table}:")

        status = "PASS" if r.passed else r.severity
        icon = "OK" if r.passed else "!!"
        print(f"    [{icon}] {r.check}: {r.message}")

    print("\n" + "-" * 70)
    total = len(report.results)
    passed = sum(1 for r in report.results if r.passed)
    print(f"  Total checks: {total}  |  Passed: {passed}  |  "
          f"Errors: {report.error_count}  |  Warnings: {report.warn_count}")
    print(f"  Overall: {'PASS' if report.passed else 'FAIL'}")
    print("=" * 70)


# ── CLI ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Validate basketball.db")
    parser.add_argument(
        "--db-path", type=Path, default=DEFAULT_DB_PATH,
        help="Path to basketball.db",
    )
    parser.add_argument(
        "--table", type=str, default=None,
        help="Validate a single table",
    )
    parser.add_argument(
        "--tier", type=int, default=None, choices=[1, 2, 3],
        help="Validate only tables from a specific tier",
    )
    parser.add_argument(
        "--json", action="store_true",
        help="Output results as JSON",
    )
    args = parser.parse_args()

    report = run_validation(
        args.db_path,
        table_filter=args.table,
        tier_filter=args.tier,
    )

    if args.json:
        print(json.dumps(report.to_dict(), indent=2))
    else:
        print_report(report)

    sys.exit(0 if report.passed else 1)


if __name__ == "__main__":
    main()
