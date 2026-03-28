"""Tests for the alignment module."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from models.schemas import ClipSegment
from pipeline.align import (
    AlignmentResult,
    PlayByPlayEvent,
    _parse_game_clock_seconds,
    align_clips_to_pbp,
)


class TestParseGameClock:
    def test_standard_format(self) -> None:
        assert _parse_game_clock_seconds("8:42") == 8 * 60 + 42

    def test_zero_minutes(self) -> None:
        assert _parse_game_clock_seconds("0:30") == 30

    def test_full_quarter(self) -> None:
        assert _parse_game_clock_seconds("12:00") == 720

    def test_invalid_returns_zero(self) -> None:
        assert _parse_game_clock_seconds("invalid") == 0.0

    def test_empty_returns_zero(self) -> None:
        assert _parse_game_clock_seconds("") == 0.0


class TestAlignClipsToPbp:
    def _make_clips(self) -> list[ClipSegment]:
        return [
            ClipSegment(start_time=10.0, end_time=18.0, confidence=0.8),
            ClipSegment(start_time=50.0, end_time=60.0, confidence=0.7),
            ClipSegment(start_time=100.0, end_time=115.0, confidence=0.6),
        ]

    def _make_events(self) -> list[PlayByPlayEvent]:
        return [
            PlayByPlayEvent(
                quarter=1, game_clock="11:45", event_type="shot",
                description="Curry 3PT", player="Stephen Curry",
                team="Warriors", home_score=3, away_score=0,
            ),
            PlayByPlayEvent(
                quarter=1, game_clock="11:00", event_type="shot",
                description="LeBron layup", player="LeBron James",
                team="Lakers", home_score=3, away_score=2,
            ),
            PlayByPlayEvent(
                quarter=1, game_clock="10:15", event_type="turnover",
                description="Bad pass", player="Kevin Durant",
                team="Suns", home_score=3, away_score=2,
            ),
        ]

    def test_returns_alignment_results(self) -> None:
        clips = self._make_clips()
        events = self._make_events()
        results = align_clips_to_pbp(clips, events)
        assert len(results) == len(clips)
        assert all(isinstance(r, AlignmentResult) for r in results)

    def test_empty_events_returns_unaligned(self) -> None:
        clips = self._make_clips()
        results = align_clips_to_pbp(clips, [])
        assert len(results) == len(clips)
        for r in results:
            assert r.matched_event is None
            assert r.alignment_confidence == 0.0

    def test_empty_clips_returns_empty(self) -> None:
        events = self._make_events()
        results = align_clips_to_pbp([], events)
        assert len(results) == 0

    def test_confidence_is_bounded(self) -> None:
        clips = self._make_clips()
        events = self._make_events()
        results = align_clips_to_pbp(clips, events)
        for r in results:
            assert 0.0 <= r.alignment_confidence <= 1.0

    def test_quarter_filter(self) -> None:
        clips = self._make_clips()
        events = self._make_events()
        # Filter to quarter 2 (no events match) -> should still match closest
        results = align_clips_to_pbp(clips, events, quarter=2)
        # Events are filtered to Q2 (empty), so no matches
        for r in results:
            assert r.matched_event is None

    def test_preserves_clip_segments(self) -> None:
        clips = self._make_clips()
        events = self._make_events()
        results = align_clips_to_pbp(clips, events)
        for clip, result in zip(clips, results):
            assert result.clip_segment is clip
