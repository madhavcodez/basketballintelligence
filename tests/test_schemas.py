"""
Tests for Pydantic validation models (scripts/models.py)
and pipeline configuration (scripts/pipeline_config.py).
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest
from pydantic import ValidationError

PROJECT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_DIR / "scripts"))

from models import (
    AllDefenseTeamRow,
    AllNBATeamRow,
    AllStarSelectionsRow,
    AwardsMajorRow,
    BBRefStandardRow,
    ContractsRow,
    DraftCombineRow,
    InjuryHistoryRow,
    Per100PossRow,
    Per36MinRow,
    PlayoffGameLogRow,
    PlayoffsPerGameRow,
    PlayerStatsDefenseRow,
    PlayerStatsScoringRow,
    PlayerStatsUsageRow,
    ShootingSplitsRow,
    TABLE_MODEL_MAP,
    TeamFourFactorsRow,
    TeamOpponentPerGameRow,
    TotalsRow,
)
from pipeline_config import (
    ALL_NEW_TABLES,
    ALL_TABLE_NAMES,
    EXISTING_TABLES,
    TABLE_REGISTRY,
    TableSpec,
)


# ── Pipeline Config Tests ────────────────────────────────────────────────────


class TestPipelineConfig:
    def test_18_new_tables_defined(self):
        assert len(ALL_NEW_TABLES) == 18

    def test_tier_distribution(self):
        tier1 = [t for t in ALL_NEW_TABLES if t.tier == 1]
        tier2 = [t for t in ALL_NEW_TABLES if t.tier == 2]
        tier3 = [t for t in ALL_NEW_TABLES if t.tier == 3]
        assert len(tier1) == 5
        assert len(tier2) == 11
        assert len(tier3) == 2

    def test_all_tables_have_unique_names(self):
        names = [t.name for t in ALL_NEW_TABLES]
        assert len(names) == len(set(names))

    def test_table_registry_complete(self):
        for table in ALL_NEW_TABLES:
            assert table.name in TABLE_REGISTRY
            assert TABLE_REGISTRY[table.name] is table

    def test_existing_tables_count(self):
        assert len(EXISTING_TABLES) == 13

    def test_all_table_names_count(self):
        assert len(ALL_TABLE_NAMES) == 13 + 18  # 31 total

    def test_table_spec_immutability(self):
        spec = ALL_NEW_TABLES[0]
        with pytest.raises(AttributeError):
            spec.name = "changed"  # type: ignore

    def test_all_specs_have_source_pattern(self):
        for spec in ALL_NEW_TABLES:
            assert spec.source_pattern, f"{spec.name} has no source_pattern"

    def test_all_specs_have_columns(self):
        for spec in ALL_NEW_TABLES:
            assert len(spec.columns) > 0, f"{spec.name} has no columns"

    def test_shooting_splits_has_multi_header(self):
        shooting = TABLE_REGISTRY["player_shooting_splits"]
        assert shooting.has_multi_header is True

    def test_multi_season_tables_have_season_from_filename(self):
        multi_season = [
            t for t in ALL_NEW_TABLES if t.source_type == "multi_season_glob"
        ]
        for t in multi_season:
            assert t.season_from_filename is True, (
                f"{t.name} should have season_from_filename=True"
            )


# ── Pydantic Model Tests ────────────────────────────────────────────────────


class TestBBRefStandardRow:
    def test_valid_row(self):
        row = BBRefStandardRow(Player="LeBron James", Age="38", Team="LAL")
        assert row.Player == "LeBron James"

    def test_empty_player_fails(self):
        with pytest.raises(ValidationError):
            BBRefStandardRow(Player="")

    def test_extra_fields_allowed(self):
        row = BBRefStandardRow(Player="Test", extra_field="value")
        assert row.Player == "Test"


class TestPer100PossRow:
    def test_valid_row(self):
        row = Per100PossRow(Player="Curry", ORtg="118", DRtg="115")
        assert row.ORtg == "118"
        assert row.DRtg == "115"


class TestPer36MinRow:
    def test_valid_row(self):
        row = Per36MinRow(Player="Jokic", Season="2023-24")
        assert row.Season == "2023-24"


class TestTotalsRow:
    def test_valid_row(self):
        row = TotalsRow(Player="Doncic", **{"Trp-Dbl": "15"})
        assert row.Trp_Dbl == "15"


class TestPlayoffsPerGameRow:
    def test_valid_row(self):
        row = PlayoffsPerGameRow(Player="Jordan", Tm="CHI", Season="1997-98")
        assert row.Tm == "CHI"

    def test_empty_player_fails(self):
        with pytest.raises(ValidationError):
            PlayoffsPerGameRow(Player="", Tm="CHI")


class TestShootingSplitsRow:
    def test_valid_row(self):
        row = ShootingSplitsRow(
            Player="Curry", Avg_Dist="15.2", Season="2023-24"
        )
        assert row.Avg_Dist == "15.2"

    def test_empty_player_fails(self):
        with pytest.raises(ValidationError):
            ShootingSplitsRow(Player="   ")


class TestAllNBATeamRow:
    def test_valid_row(self):
        row = AllNBATeamRow(
            season="2024-25", player_name="Jokic", team_number="1st"
        )
        assert row.season == "2024-25"

    def test_empty_season_fails(self):
        with pytest.raises(ValidationError):
            AllNBATeamRow(season="", player_name="Test")


class TestAllDefenseTeamRow:
    def test_valid_row(self):
        row = AllDefenseTeamRow(season="2024-25", player_name="Daniels")
        assert row.player_name == "Daniels"


class TestAllStarSelectionsRow:
    def test_valid_row(self):
        row = AllStarSelectionsRow(
            player="LeBron James", all_star_selections="22"
        )
        assert row.all_star_selections == "22"


class TestAwardsMajorRow:
    def test_valid_row(self):
        row = AwardsMajorRow(
            season="2024-25", player_name="Castle", award_type="ROY"
        )
        assert row.award_type == "ROY"


class TestContractsRow:
    def test_valid_row(self):
        row = ContractsRow(
            name="Shaquille O'Neal", salary="17142000", season="2000"
        )
        assert row.salary == "17142000"


class TestDraftCombineRow:
    def test_valid_row(self):
        row = DraftCombineRow(
            player="Blake Griffin", year="2009", wingspan="83.25"
        )
        assert row.wingspan == "83.25"


class TestTeamFourFactorsRow:
    def test_valid_row(self):
        row = TeamFourFactorsRow(team_name="Atlanta Hawks", season="1996-97")
        assert row.team_name == "Atlanta Hawks"


class TestTeamOpponentPerGameRow:
    def test_valid_row(self):
        row = TeamOpponentPerGameRow(team_name="Boston Celtics")
        assert row.team_name == "Boston Celtics"


class TestPlayerStatsDefenseRow:
    def test_valid_row(self):
        row = PlayerStatsDefenseRow(
            player_name="A.C. Green", def_rating="104.8"
        )
        assert row.def_rating == "104.8"


class TestPlayerStatsScoringRow:
    def test_valid_row(self):
        row = PlayerStatsScoringRow(player_name="Test Player")
        assert row.player_name == "Test Player"


class TestPlayerStatsUsageRow:
    def test_valid_row(self):
        row = PlayerStatsUsageRow(
            player_name="A.C. Green", usg_pct="0.118"
        )
        assert row.usg_pct == "0.118"


class TestPlayoffGameLogRow:
    def test_valid_row(self):
        row = PlayoffGameLogRow(
            personname="Juwan Howard", season_year="2011-12", points="0"
        )
        assert row.points == "0"


class TestInjuryHistoryRow:
    def test_valid_row(self):
        row = InjuryHistoryRow(
            date="2010-10-03", team="Bulls",
            relinquished="Carlos Boozer",
            notes="fractured bone",
        )
        assert row.team == "Bulls"


class TestTableModelMap:
    def test_all_18_tables_mapped(self):
        assert len(TABLE_MODEL_MAP) == 18

    def test_all_new_tables_have_model(self):
        for spec in ALL_NEW_TABLES:
            assert spec.name in TABLE_MODEL_MAP, (
                f"No model for {spec.name} in TABLE_MODEL_MAP"
            )

    def test_all_models_are_pydantic(self):
        from pydantic import BaseModel
        for name, model in TABLE_MODEL_MAP.items():
            assert issubclass(model, BaseModel), (
                f"{name} model is not a Pydantic BaseModel"
            )
