#!/usr/bin/env python3
"""
Add composite indexes to basketball.db for query performance.
Run once after database ingestion. Safe to re-run (uses IF NOT EXISTS).
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'basketball.db')

INDEXES = [
    # Composite indexes for player+season filtering (critical for <100ms targets)
    "CREATE INDEX IF NOT EXISTS idx_shots_player_season ON shots(PLAYER_NAME, season)",
    "CREATE INDEX IF NOT EXISTS idx_shots_player_game_date ON shots(PLAYER_NAME, GAME_DATE DESC)",
    "CREATE INDEX IF NOT EXISTS idx_player_stats_pergame_player_season ON player_stats_pergame(Player, Season)",
    "CREATE INDEX IF NOT EXISTS idx_player_stats_advanced_player_season ON player_stats_advanced(Player, Season)",
    "CREATE INDEX IF NOT EXISTS idx_lineups_team_season ON lineups(TEAM_ABBREVIATION, season)",
    "CREATE INDEX IF NOT EXISTS idx_career_leaders_stat_league ON career_leaders(stat, league)",
    "CREATE INDEX IF NOT EXISTS idx_team_game_logs_team_season ON team_game_logs(TEAM_ABBREVIATION, SEASON_ID)",
    # Shot Lab: league baseline zone aggregation (BAS-11)
    "CREATE INDEX IF NOT EXISTS idx_shots_season_zone ON shots(season, SHOT_ZONE_BASIC, SHOT_ZONE_AREA)",
]

def main():
    conn = sqlite3.connect(DB_PATH)
    try:
        for sql in INDEXES:
            name = sql.split("idx_")[1].split(" ")[0]
            conn.execute(sql)
            print(f"  ✓ idx_{name}")
        conn.execute("ANALYZE")
        print("  ✓ ANALYZE complete")
        conn.commit()
        print("Done. All indexes created.")
    finally:
        conn.close()

if __name__ == '__main__':
    main()
