#!/usr/bin/env python3
"""
Pydantic validation models for all 18 new ingestion tables.

Each model validates a single row from its respective CSV/table.
Used by the validation framework (validate.py) for schema enforcement.
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field, field_validator


class _PermissiveBase(BaseModel):
    """Base model that allows extra fields and coerces types permissively."""
    model_config = {"extra": "allow", "coerce_numbers_to_str": False}


# ── Tier 1: BBRef multi-season CSVs ─────────────────────────────────────────

class BBRefStandardRow(_PermissiveBase):
    """Common columns shared by per100, per36, totals BBRef tables."""
    Rk: Optional[str] = None
    Player: str
    Age: Optional[str] = None
    Team: Optional[str] = None
    Pos: Optional[str] = None
    G: Optional[str] = None
    GS: Optional[str] = None
    MP: Optional[str] = None
    Season: Optional[str] = None

    @field_validator("Player")
    @classmethod
    def player_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Player name cannot be empty")
        return v.strip()


class Per100PossRow(BBRefStandardRow):
    """Row from player_stats_per100poss."""
    ORtg: Optional[str] = None
    DRtg: Optional[str] = None


class Per36MinRow(BBRefStandardRow):
    """Row from player_stats_per36min."""
    pass


class TotalsRow(BBRefStandardRow):
    """Row from player_stats_totals."""
    Trp_Dbl: Optional[str] = Field(None, alias="Trp-Dbl")


class PlayoffsPerGameRow(_PermissiveBase):
    """Row from player_stats_playoffs_pergame_bbref."""
    Rk: Optional[str] = None
    Player: str
    Pos: Optional[str] = None
    Age: Optional[str] = None
    Tm: Optional[str] = None
    G: Optional[str] = None
    Season: Optional[str] = None

    @field_validator("Player")
    @classmethod
    def player_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Player name cannot be empty")
        return v.strip()


class ShootingSplitsRow(_PermissiveBase):
    """Row from player_shooting_splits (positional index columns)."""
    Rk: Optional[str] = None
    Player: str
    Age: Optional[str] = None
    Team: Optional[str] = None
    Pos: Optional[str] = None
    G: Optional[str] = None
    GS: Optional[str] = None
    MP: Optional[str] = None
    FG_pct: Optional[str] = None
    Avg_Dist: Optional[str] = None
    Season: Optional[str] = None

    @field_validator("Player")
    @classmethod
    def player_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Player name cannot be empty")
        return v.strip()


# ── Tier 2: Enrichment single-file CSVs ─────────────────────────────────────

class AllNBATeamRow(_PermissiveBase):
    """Row from all_nba_teams."""
    season: str
    league: Optional[str] = None
    team_number: Optional[str] = None
    player_name: str
    position: Optional[str] = None

    @field_validator("season")
    @classmethod
    def season_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Season cannot be empty")
        return v.strip()


class AllDefenseTeamRow(_PermissiveBase):
    """Row from all_defense_teams."""
    season: str
    league: Optional[str] = None
    team_number: Optional[str] = None
    player_name: str
    position: Optional[str] = None


class AllStarSelectionsRow(_PermissiveBase):
    """Row from all_star_selections."""
    rank: Optional[str] = None
    player: str
    all_star_selections: Optional[str] = None


class AwardsMajorRow(_PermissiveBase):
    """Row from awards_major."""
    season: str
    player_name: str
    team: Optional[str] = None
    award_type: str


class ContractsRow(_PermissiveBase):
    """Row from contracts."""
    rank: Optional[str] = None
    name: str
    position: Optional[str] = None
    team: Optional[str] = None
    salary: Optional[str] = None
    season: Optional[str] = None


class DraftCombineRow(_PermissiveBase):
    """Row from draft_combine."""
    player: str
    year: Optional[str] = None
    draft_pick: Optional[str] = None
    height_no_shoes: Optional[str] = None
    height_with_shoes: Optional[str] = None
    wingspan: Optional[str] = None
    standing_reach: Optional[str] = None
    weight: Optional[str] = None


class TeamFourFactorsRow(_PermissiveBase):
    """Row from team_four_factors."""
    team_id: Optional[str] = None
    team_name: str
    gp: Optional[str] = None
    season: Optional[str] = None


class TeamOpponentPerGameRow(_PermissiveBase):
    """Row from team_opponent_pergame."""
    team_id: Optional[str] = None
    team_name: str
    gp: Optional[str] = None
    season: Optional[str] = None


class PlayerStatsDefenseRow(_PermissiveBase):
    """Row from player_stats_defense."""
    player_id: Optional[str] = None
    player_name: str
    team_abbreviation: Optional[str] = None
    season: Optional[str] = None
    def_rating: Optional[str] = None


class PlayerStatsScoringRow(_PermissiveBase):
    """Row from player_stats_scoring."""
    player_id: Optional[str] = None
    player_name: str
    team_abbreviation: Optional[str] = None
    season: Optional[str] = None


class PlayerStatsUsageRow(_PermissiveBase):
    """Row from player_stats_usage."""
    player_id: Optional[str] = None
    player_name: str
    team_abbreviation: Optional[str] = None
    season: Optional[str] = None
    usg_pct: Optional[str] = None


# ── Tier 3: Playoff extended ────────────────────────────────────────────────

class PlayoffGameLogRow(_PermissiveBase):
    """Row from playoff_game_logs."""
    season_year: Optional[str] = None
    game_date: Optional[str] = None
    gameid: Optional[str] = None
    personname: Optional[str] = None
    teamname: Optional[str] = None
    points: Optional[str] = None


class InjuryHistoryRow(_PermissiveBase):
    """Row from injury_history."""
    date: Optional[str] = None
    team: Optional[str] = None
    acquired: Optional[str] = None
    relinquished: Optional[str] = None
    notes: Optional[str] = None


# ── Model Registry ──────────────────────────────────────────────────────────

TABLE_MODEL_MAP: dict[str, type[_PermissiveBase]] = {
    "player_stats_per100poss": Per100PossRow,
    "player_stats_per36min": Per36MinRow,
    "player_stats_totals": TotalsRow,
    "player_stats_playoffs_pergame_bbref": PlayoffsPerGameRow,
    "player_shooting_splits": ShootingSplitsRow,
    "all_nba_teams": AllNBATeamRow,
    "all_defense_teams": AllDefenseTeamRow,
    "all_star_selections_new": AllStarSelectionsRow,
    "awards_major": AwardsMajorRow,
    "contracts": ContractsRow,
    "draft_combine": DraftCombineRow,
    "team_four_factors": TeamFourFactorsRow,
    "team_opponent_pergame": TeamOpponentPerGameRow,
    "player_stats_defense_new": PlayerStatsDefenseRow,
    "player_stats_scoring_new": PlayerStatsScoringRow,
    "player_stats_usage_new": PlayerStatsUsageRow,
    "playoff_game_logs": PlayoffGameLogRow,
    "injury_history": InjuryHistoryRow,
}
