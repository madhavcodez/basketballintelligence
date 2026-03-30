#!/usr/bin/env python3
"""
Add composite indexes to basketball.db for query performance.
Run once after database ingestion. Safe to re-run (uses IF NOT EXISTS).
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'basketball.db')

INDEXES = [
    # ── Original 8 indexes ──────────────────────────────────────────────
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

    # ── NEW: Tier 1 BBRef multi-season tables (~10 indexes) ────────────

    # player_stats_per100poss
    "CREATE INDEX IF NOT EXISTS idx_per100_player ON player_stats_per100poss(Player)",
    "CREATE INDEX IF NOT EXISTS idx_per100_player_season ON player_stats_per100poss(Player, Season)",
    "CREATE INDEX IF NOT EXISTS idx_per100_team_season ON player_stats_per100poss(Team, Season)",

    # player_stats_per36min
    "CREATE INDEX IF NOT EXISTS idx_per36_player ON player_stats_per36min(Player)",
    "CREATE INDEX IF NOT EXISTS idx_per36_player_season ON player_stats_per36min(Player, Season)",
    "CREATE INDEX IF NOT EXISTS idx_per36_team_season ON player_stats_per36min(Team, Season)",

    # player_stats_totals
    "CREATE INDEX IF NOT EXISTS idx_totals_player ON player_stats_totals(Player)",
    "CREATE INDEX IF NOT EXISTS idx_totals_player_season ON player_stats_totals(Player, Season)",
    "CREATE INDEX IF NOT EXISTS idx_totals_team_season ON player_stats_totals(Team, Season)",

    # player_stats_playoffs_pergame_bbref
    "CREATE INDEX IF NOT EXISTS idx_po_bbref_player ON player_stats_playoffs_pergame_bbref(Player)",
    "CREATE INDEX IF NOT EXISTS idx_po_bbref_player_season ON player_stats_playoffs_pergame_bbref(Player, Season)",
    "CREATE INDEX IF NOT EXISTS idx_po_bbref_tm_season ON player_stats_playoffs_pergame_bbref(Tm, Season)",

    # player_shooting_splits
    "CREATE INDEX IF NOT EXISTS idx_shooting_player ON player_shooting_splits(Player)",
    "CREATE INDEX IF NOT EXISTS idx_shooting_player_season ON player_shooting_splits(Player, Season)",
    "CREATE INDEX IF NOT EXISTS idx_shooting_team_season ON player_shooting_splits(Team, Season)",

    # ── NEW: Tier 2 Enrichment tables (~20 indexes) ────────────────────

    # all_nba_teams
    "CREATE INDEX IF NOT EXISTS idx_allnba_player ON all_nba_teams(player_name)",
    "CREATE INDEX IF NOT EXISTS idx_allnba_season ON all_nba_teams(season)",
    "CREATE INDEX IF NOT EXISTS idx_allnba_player_season ON all_nba_teams(player_name, season)",

    # all_defense_teams
    "CREATE INDEX IF NOT EXISTS idx_alldef_player ON all_defense_teams(player_name)",
    "CREATE INDEX IF NOT EXISTS idx_alldef_season ON all_defense_teams(season)",

    # all_star_selections_new
    "CREATE INDEX IF NOT EXISTS idx_allstar_player ON all_star_selections_new(player)",

    # awards_major
    "CREATE INDEX IF NOT EXISTS idx_awards_major_player ON awards_major(player_name)",
    "CREATE INDEX IF NOT EXISTS idx_awards_major_season ON awards_major(season)",
    "CREATE INDEX IF NOT EXISTS idx_awards_major_type ON awards_major(award_type)",

    # contracts
    "CREATE INDEX IF NOT EXISTS idx_contracts_name ON contracts(name)",
    "CREATE INDEX IF NOT EXISTS idx_contracts_season ON contracts(season)",
    "CREATE INDEX IF NOT EXISTS idx_contracts_team ON contracts(team)",

    # draft_combine
    "CREATE INDEX IF NOT EXISTS idx_combine_player ON draft_combine(player)",
    "CREATE INDEX IF NOT EXISTS idx_combine_year ON draft_combine(year)",

    # team_four_factors
    "CREATE INDEX IF NOT EXISTS idx_t4f_team ON team_four_factors(team_name)",
    "CREATE INDEX IF NOT EXISTS idx_t4f_team_season ON team_four_factors(team_name, season)",

    # team_opponent_pergame
    "CREATE INDEX IF NOT EXISTS idx_topp_team ON team_opponent_pergame(team_name)",
    "CREATE INDEX IF NOT EXISTS idx_topp_team_season ON team_opponent_pergame(team_name, season)",

    # player_stats_defense_new
    "CREATE INDEX IF NOT EXISTS idx_def_player ON player_stats_defense_new(player_name)",
    "CREATE INDEX IF NOT EXISTS idx_def_player_season ON player_stats_defense_new(player_name, season)",

    # player_stats_scoring_new
    "CREATE INDEX IF NOT EXISTS idx_scoring_player ON player_stats_scoring_new(player_name)",
    "CREATE INDEX IF NOT EXISTS idx_scoring_player_season ON player_stats_scoring_new(player_name, season)",

    # player_stats_usage_new
    "CREATE INDEX IF NOT EXISTS idx_usage_player ON player_stats_usage_new(player_name)",
    "CREATE INDEX IF NOT EXISTS idx_usage_player_season ON player_stats_usage_new(player_name, season)",

    # ── NEW: Tier 3 Playoff extended (~5 indexes) ─────────────────────

    # playoff_game_logs
    "CREATE INDEX IF NOT EXISTS idx_pogl_person ON playoff_game_logs(personname)",
    "CREATE INDEX IF NOT EXISTS idx_pogl_person_season ON playoff_game_logs(personname, season_year)",
    "CREATE INDEX IF NOT EXISTS idx_pogl_game_date ON playoff_game_logs(game_date)",
    "CREATE INDEX IF NOT EXISTS idx_pogl_team ON playoff_game_logs(teamtricode, season_year)",

    # injury_history
    "CREATE INDEX IF NOT EXISTS idx_injury_team ON injury_history(team)",
    "CREATE INDEX IF NOT EXISTS idx_injury_date ON injury_history(date)",

    # ── NEW: Additional single-column indexes ─────────────────────────
    "CREATE INDEX IF NOT EXISTS idx_player_game_logs_player ON player_game_logs(PLAYER_NAME)",
    "CREATE INDEX IF NOT EXISTS idx_player_game_logs_season ON player_game_logs(SEASON_ID)",
    "CREATE INDEX IF NOT EXISTS idx_draft_player ON draft(Player)",
    "CREATE INDEX IF NOT EXISTS idx_awards_player ON awards(Player)",
    "CREATE INDEX IF NOT EXISTS idx_standings_season ON standings(Season)",
    "CREATE INDEX IF NOT EXISTS idx_tracking_player ON tracking(PLAYER_NAME)",
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
