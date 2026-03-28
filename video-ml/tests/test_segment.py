"""Tests for the segmentation module."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

# Add parent to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import PipelineConfig
from models.schemas import ClipSegment
from pipeline.segment import _segment_uniform_fallback, segment_video


class TestUniformFallback:
    """Test the uniform fallback segmentation."""

    def test_produces_clips(self) -> None:
        config = PipelineConfig()
        segments = _segment_uniform_fallback(60.0, config)
        assert len(segments) > 0

    def test_clips_cover_duration(self) -> None:
        config = PipelineConfig()
        segments = _segment_uniform_fallback(60.0, config)
        assert segments[0].start_time == 0.0
        assert segments[-1].end_time <= 60.0

    def test_no_overlapping_clips(self) -> None:
        config = PipelineConfig()
        segments = _segment_uniform_fallback(120.0, config)
        for i in range(1, len(segments)):
            assert segments[i].start_time >= segments[i - 1].end_time

    def test_respects_min_duration(self) -> None:
        config = PipelineConfig(min_clip_duration=5.0)
        segments = _segment_uniform_fallback(120.0, config)
        for seg in segments:
            assert seg.duration >= config.min_clip_duration

    def test_short_video(self) -> None:
        config = PipelineConfig(min_clip_duration=5.0)
        segments = _segment_uniform_fallback(3.0, config)
        # Video too short for any clip
        assert len(segments) == 0

    def test_confidence_is_low_for_fallback(self) -> None:
        config = PipelineConfig()
        segments = _segment_uniform_fallback(60.0, config)
        for seg in segments:
            assert seg.confidence < 0.5


class TestSegmentVideo:
    """Test the main segment_video function."""

    def test_returns_list_of_segments(self) -> None:
        # With a non-existent file, should use fallback
        segments = segment_video(
            Path("nonexistent.mp4"),
            duration_hint=60.0,
        )
        assert isinstance(segments, list)
        assert all(isinstance(s, ClipSegment) for s in segments)

    def test_uses_duration_hint(self) -> None:
        segments = segment_video(Path("fake.mp4"), duration_hint=30.0)
        for seg in segments:
            assert seg.end_time <= 30.0

    def test_default_duration_when_no_hint(self) -> None:
        segments = segment_video(Path("fake.mp4"))
        # Should use 120.0 default
        assert len(segments) > 0
        assert segments[-1].end_time <= 120.0
