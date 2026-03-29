"""Tests for the object detection module."""
from __future__ import annotations
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import PipelineConfig
from models.schemas import ClipSegment, DetectedObject, DetectionResult
from pipeline.detect import (
    detect_objects_in_clip,
    _mock_detection_for_frame,
    _estimate_hoop,
)


class TestMockDetection:
    def test_returns_detection_result(self):
        result = _mock_detection_for_frame(0, 0.0)
        assert isinstance(result, DetectionResult)

    def test_has_players(self):
        result = _mock_detection_for_frame(42, 1.4)
        players = [o for o in result.objects if o.label == "player"]
        assert len(players) >= 3

    def test_deterministic(self):
        r1 = _mock_detection_for_frame(100, 3.33)
        r2 = _mock_detection_for_frame(100, 3.33)
        assert r1.objects == r2.objects

    def test_different_frames_differ(self):
        r1 = _mock_detection_for_frame(0, 0.0)
        r2 = _mock_detection_for_frame(1, 0.033)
        # Should differ (different seeds)
        assert r1.objects != r2.objects


class TestEstimateHoop:
    def test_returns_none_with_few_players(self):
        players = [
            DetectedObject(label="player", confidence=0.9, bbox=(0.3, 0.2, 0.35, 0.4)),
            DetectedObject(label="player", confidence=0.9, bbox=(0.5, 0.2, 0.55, 0.4)),
        ]
        assert _estimate_hoop(players) is None

    def test_returns_hoop_with_enough_players(self):
        players = [
            DetectedObject(label="player", confidence=0.9, bbox=(0.2, 0.2, 0.25, 0.4)),
            DetectedObject(label="player", confidence=0.9, bbox=(0.4, 0.2, 0.45, 0.4)),
            DetectedObject(label="player", confidence=0.9, bbox=(0.6, 0.2, 0.65, 0.4)),
        ]
        hoop = _estimate_hoop(players)
        assert hoop is not None
        assert hoop.label == "hoop"
        assert 0.0 <= hoop.bbox[1] <= 0.15  # top of frame

    def test_hoop_confidence_is_synthetic(self):
        players = [
            DetectedObject(label="player", confidence=0.9, bbox=(0.1 * i, 0.2, 0.1 * i + 0.05, 0.4))
            for i in range(5)
        ]
        hoop = _estimate_hoop(players)
        assert hoop is not None
        assert hoop.confidence == 0.55


class TestDetectObjectsInClip:
    def test_fallback_to_mock(self):
        segment = ClipSegment(start_time=0.0, end_time=10.0, confidence=0.5)
        results = detect_objects_in_clip(Path("nonexistent.mp4"), segment)
        assert len(results) > 0
        assert all(isinstance(r, DetectionResult) for r in results)

    def test_mock_count_matches_fps(self):
        config = PipelineConfig(target_fps=2.0)
        segment = ClipSegment(start_time=0.0, end_time=5.0, confidence=0.5)
        results = detect_objects_in_clip(Path("nonexistent.mp4"), segment, config)
        assert len(results) == 10  # 5s * 2fps

    def test_objects_have_valid_labels(self):
        segment = ClipSegment(start_time=0.0, end_time=5.0, confidence=0.5)
        results = detect_objects_in_clip(Path("nonexistent.mp4"), segment)
        for r in results:
            for obj in r.objects:
                assert obj.label in ("player", "ball", "hoop")

    def test_default_config_used(self):
        segment = ClipSegment(start_time=0.0, end_time=3.0, confidence=0.5)
        results = detect_objects_in_clip(Path("no_such.mp4"), segment)
        assert len(results) >= 1

    def test_timestamps_increase(self):
        config = PipelineConfig(target_fps=2.0)
        segment = ClipSegment(start_time=5.0, end_time=10.0, confidence=0.5)
        results = detect_objects_in_clip(Path("missing.mp4"), segment, config)
        timestamps = [r.timestamp for r in results]
        assert timestamps == sorted(timestamps)
        assert timestamps[0] >= 5.0

    def test_frame_numbers_are_positive(self):
        segment = ClipSegment(start_time=1.0, end_time=3.0, confidence=0.5)
        results = detect_objects_in_clip(Path("x.mp4"), segment)
        for r in results:
            assert r.frame_number >= 0

    def test_court_detected_in_mock(self):
        segment = ClipSegment(start_time=0.0, end_time=5.0, confidence=0.5)
        results = detect_objects_in_clip(Path("x.mp4"), segment)
        # Most mock frames should have court_detected
        court_count = sum(1 for r in results if r.court_detected)
        assert court_count > 0

    def test_confidence_bounds(self):
        segment = ClipSegment(start_time=0.0, end_time=5.0, confidence=0.5)
        results = detect_objects_in_clip(Path("x.mp4"), segment)
        for r in results:
            for obj in r.objects:
                assert 0.0 <= obj.confidence <= 1.0

    def test_bbox_normalized(self):
        segment = ClipSegment(start_time=0.0, end_time=3.0, confidence=0.5)
        results = detect_objects_in_clip(Path("x.mp4"), segment)
        for r in results:
            for obj in r.objects:
                x1, y1, x2, y2 = obj.bbox
                assert 0.0 <= x1 <= 1.0
                assert 0.0 <= y1 <= 1.0
                assert x2 <= 1.1  # allow small margin
                assert y2 <= 1.1


class TestEstimateHoopEdgeCases:
    def test_empty_players(self):
        assert _estimate_hoop([]) is None

    def test_hoop_bbox_within_bounds(self):
        players = [
            DetectedObject(label="player", confidence=0.9, bbox=(0.0, 0.2, 0.05, 0.4)),
            DetectedObject(label="player", confidence=0.9, bbox=(0.95, 0.2, 1.0, 0.4)),
            DetectedObject(label="player", confidence=0.9, bbox=(0.5, 0.2, 0.55, 0.4)),
        ]
        hoop = _estimate_hoop(players)
        assert hoop is not None
        x1, y1, x2, y2 = hoop.bbox
        assert x1 >= 0.0
        assert x2 <= 1.0

    def test_many_players(self):
        players = [
            DetectedObject(label="player", confidence=0.9, bbox=(0.1 * i, 0.2, 0.1 * i + 0.05, 0.4))
            for i in range(10)
        ]
        hoop = _estimate_hoop(players)
        assert hoop is not None
