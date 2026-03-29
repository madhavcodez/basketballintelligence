"""Tests for the cross-database linking module."""
from __future__ import annotations
import sys
import sqlite3
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import PipelineConfig
from pipeline.link import (
    _parse_game_clock_to_seconds,
    _fuzzy_name_match,
    link_clip_to_shot,
    link_clip_to_game_log,
    link_all_clips,
    LinkSummary,
)


class TestParseGameClock:
    def test_standard(self):
        assert _parse_game_clock_to_seconds("8:42") == 522.0

    def test_zero_minutes(self):
        assert _parse_game_clock_to_seconds("0:03") == 3.0

    def test_full_quarter(self):
        assert _parse_game_clock_to_seconds("12:00") == 720.0

    def test_empty_returns_zero(self):
        assert _parse_game_clock_to_seconds("") == 0.0

    def test_invalid_returns_zero(self):
        assert _parse_game_clock_to_seconds("bad") == 0.0


class TestFuzzyNameMatch:
    def test_exact_match(self):
        assert _fuzzy_name_match("LeBron James", "LeBron James") == 1.0

    def test_case_insensitive(self):
        ratio = _fuzzy_name_match("lebron james", "LeBron James")
        assert ratio > 0.9

    def test_partial_match(self):
        ratio = _fuzzy_name_match("LeBron", "LeBron James")
        assert ratio > 0.5

    def test_no_match(self):
        ratio = _fuzzy_name_match("Kevin Durant", "LeBron James")
        assert ratio < 0.5

    def test_empty_returns_zero(self):
        assert _fuzzy_name_match("", "LeBron") == 0.0


class TestLinkClipToShot:
    def test_finds_matching_shot(self, basketball_db):
        # Shot at Q1, 8:42 (522s) - clip game_clock "8:42" should match
        result = link_clip_to_shot(1, "8:42", "G001", basketball_db)
        assert result is not None

    def test_no_match_wrong_quarter(self, basketball_db):
        result = link_clip_to_shot(4, "8:42", "G001", basketball_db)
        assert result is None

    def test_no_match_wrong_game(self, basketball_db):
        result = link_clip_to_shot(1, "8:42", "G999", basketball_db)
        assert result is None

    def test_none_quarter(self, basketball_db):
        assert link_clip_to_shot(None, "8:42", "G001", basketball_db) is None

    def test_tolerance_within_8s(self, basketball_db):
        # Shot at 8:42 (522s), try 8:37 (517s) = 5s diff, within 8s tolerance
        result = link_clip_to_shot(1, "8:37", "G001", basketball_db)
        assert result is not None

    def test_tolerance_exceeded(self, basketball_db):
        # Shot at 8:42 (522s), try 8:20 (500s) = 22s diff, beyond 8s tolerance
        result = link_clip_to_shot(1, "8:20", "G001", basketball_db)
        assert result is None


class TestLinkClipToGameLog:
    def test_finds_matching_log(self, basketball_db):
        result = link_clip_to_game_log("LeBron James", "G001", basketball_db)
        assert result is not None
        assert "2544" in result

    def test_case_insensitive(self, basketball_db):
        result = link_clip_to_game_log("lebron james", "G001", basketball_db)
        assert result is not None

    def test_no_match(self, basketball_db):
        result = link_clip_to_game_log("Unknown Player", "G001", basketball_db)
        assert result is None

    def test_none_player(self, basketball_db):
        assert link_clip_to_game_log(None, "G001", basketball_db) is None


class TestLinkAllClips:
    def test_returns_link_summary(self, tmp_config, film_db, basketball_db):
        # Insert a video with game_id
        conn = sqlite3.connect(str(film_db))
        conn.execute(
            "INSERT INTO videos (title, filename, filepath, game_id) VALUES ('g', 'g.mp4', '/g.mp4', 'G001')"
        )
        conn.execute(
            "INSERT INTO clips (video_id, start_time, end_time, quarter, game_clock, primary_player) "
            "VALUES (1, 0, 10, 1, '8:42', 'LeBron James')"
        )
        conn.commit()
        conn.close()

        summary = link_all_clips(1, tmp_config)
        assert isinstance(summary, LinkSummary)
        assert summary.total_clips == 1

    def test_no_game_id(self, tmp_config, film_db):
        conn = sqlite3.connect(str(film_db))
        conn.execute("INSERT INTO videos (title, filename, filepath) VALUES ('g', 'g.mp4', '/g.mp4')")
        conn.commit()
        conn.close()

        summary = link_all_clips(1, tmp_config)
        assert summary.total_clips == 0
