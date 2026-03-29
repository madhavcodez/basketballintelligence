"""Tests for the scoreboard OCR module."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from utils.scoreboard_ocr import (
    ScoreboardReading,
    _parse_clock,
    _parse_scores,
    _parse_quarter,
    detect_scoreboard_region,
    extract_scoreboard,
    extract_scoreboard_from_frames,
)


class TestParseClock:
    def test_standard_format(self):
        assert _parse_clock("Game clock 8:42 remaining") == "8:42"

    def test_single_digit_minutes(self):
        assert _parse_clock("0:03") == "0:03"

    def test_full_quarter(self):
        assert _parse_clock("12:00") == "12:00"

    def test_no_clock(self):
        assert _parse_clock("no clock here") is None

    def test_invalid_seconds(self):
        assert _parse_clock("5:99") is None

    def test_empty_string(self):
        assert _parse_clock("") is None


class TestParseScores:
    def test_two_scores(self):
        away, home = _parse_scores(["98", "105"])
        assert away == 98
        assert home == 105

    def test_scores_in_text(self):
        away, home = _parse_scores(["Lakers 98 Celtics 105"])
        assert away == 98
        assert home == 105

    def test_single_score(self):
        away, home = _parse_scores(["only 42"])
        assert away == 42
        assert home is None

    def test_no_scores(self):
        away, home = _parse_scores(["no numbers"])
        assert away is None
        assert home is None

    def test_ignores_numbers_over_199(self):
        away, home = _parse_scores(["300 98 105"])
        assert away == 98
        assert home == 105


class TestParseQuarter:
    def test_q_format(self):
        assert _parse_quarter("Q3") == 3

    def test_qtr_format(self):
        assert _parse_quarter("QTR 2") == 2

    def test_ordinal_format(self):
        assert _parse_quarter("1ST") == 1

    def test_third(self):
        assert _parse_quarter("3RD") == 3

    def test_overtime(self):
        assert _parse_quarter("OT") == 5

    def test_overtime_full(self):
        assert _parse_quarter("OVERTIME") == 5

    def test_no_match(self):
        assert _parse_quarter("nothing") is None


class TestDetectScoreboardRegion:
    def test_none_frame(self):
        assert detect_scoreboard_region(None) is None

    def test_valid_frame(self):
        try:
            import numpy as np
            frame = np.zeros((1080, 1920, 3), dtype=np.uint8)
            region = detect_scoreboard_region(frame)
            assert region is not None
            x, y, w, h = region
            assert x == 0
            assert y == 0
            assert w == 1920
            assert h == int(1080 * 0.15)
        except ImportError:
            pytest.skip("numpy not available")

    def test_non_array_frame(self):
        assert detect_scoreboard_region("not a frame") is None


class TestExtractScoreboard:
    def test_none_frame_returns_zero_confidence(self):
        result = extract_scoreboard(None)
        assert isinstance(result, ScoreboardReading)
        assert result.confidence == 0.0

    def test_returns_scoreboard_reading(self):
        result = extract_scoreboard(None)
        assert isinstance(result, ScoreboardReading)


class TestExtractScoreboardFromFrames:
    def test_returns_list(self):
        results = extract_scoreboard_from_frames([None, None])
        assert len(results) == 2
        assert all(isinstance(r, ScoreboardReading) for r in results)

    def test_empty_list(self):
        results = extract_scoreboard_from_frames([])
        assert results == []
