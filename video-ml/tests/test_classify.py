"""Tests for the classification module."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import PipelineConfig
from models.schemas import ClassificationResult, DetectedObject, DetectionResult
from pipeline.classify import classify_clip, _count_objects, _estimate_ball_movement


def _make_detection(
    frame_number: int,
    *,
    num_players: int = 5,
    has_ball: bool = True,
    has_hoop: bool = True,
    ball_x: float = 0.5,
    ball_y: float = 0.5,
) -> DetectionResult:
    """Helper to create a detection result."""
    objects: list[DetectedObject] = []
    for i in range(num_players):
        objects.append(DetectedObject(
            label="player",
            confidence=0.9,
            bbox=(0.1 * i, 0.2, 0.1 * i + 0.05, 0.4),
        ))
    if has_ball:
        objects.append(DetectedObject(
            label="ball",
            confidence=0.85,
            bbox=(ball_x, ball_y, ball_x + 0.02, ball_y + 0.02),
        ))
    if has_hoop:
        objects.append(DetectedObject(
            label="hoop",
            confidence=0.95,
            bbox=(0.45, 0.05, 0.55, 0.12),
        ))

    return DetectionResult(
        frame_number=frame_number,
        timestamp=frame_number / 30.0,
        objects=objects,
        court_detected=True,
    )


class TestCountObjects:
    def test_counts_all_labels(self) -> None:
        detections = [_make_detection(0, num_players=3, has_ball=True, has_hoop=True)]
        counts = _count_objects(detections)
        assert counts["player"] == 3
        assert counts["ball"] == 1
        assert counts["hoop"] == 1

    def test_empty_detections(self) -> None:
        counts = _count_objects([])
        assert len(counts) == 0


class TestEstimateBallMovement:
    def test_stationary_ball(self) -> None:
        detections = [
            _make_detection(i, ball_x=0.5, ball_y=0.5) for i in range(5)
        ]
        movement = _estimate_ball_movement(detections)
        assert movement == 0.0

    def test_moving_ball(self) -> None:
        detections = [
            _make_detection(i, ball_x=0.1 * i, ball_y=0.5) for i in range(5)
        ]
        movement = _estimate_ball_movement(detections)
        assert movement > 0.0

    def test_no_ball(self) -> None:
        detections = [
            _make_detection(i, has_ball=False) for i in range(5)
        ]
        movement = _estimate_ball_movement(detections)
        assert movement == 0.0


class TestClassifyClip:
    def test_returns_classification_result(self) -> None:
        detections = [_make_detection(i) for i in range(10)]
        result = classify_clip(detections, 8.0)
        assert isinstance(result, ClassificationResult)

    def test_play_type_is_valid(self) -> None:
        detections = [_make_detection(i) for i in range(10)]
        result = classify_clip(detections, 8.0)
        assert result.play_type in PipelineConfig.PLAY_TYPES

    def test_has_tags(self) -> None:
        detections = [_make_detection(i) for i in range(10)]
        result = classify_clip(detections, 8.0)
        assert len(result.tags) > 0

    def test_confidence_in_range(self) -> None:
        detections = [_make_detection(i) for i in range(10)]
        result = classify_clip(detections, 8.0)
        assert 0.0 <= result.confidence <= 1.0

    def test_clip_id_passthrough(self) -> None:
        detections = [_make_detection(i) for i in range(5)]
        result = classify_clip(detections, 5.0, clip_id=42)
        assert result.clip_id == 42

    def test_short_clip_near_basket(self) -> None:
        """Short clip with hoop visible should classify as spot_up."""
        detections = [
            _make_detection(i, has_hoop=True) for i in range(3)
        ]
        result = classify_clip(detections, 3.5)
        assert result.play_type == "spot_up"

    def test_empty_detections(self) -> None:
        result = classify_clip([], 5.0)
        assert isinstance(result, ClassificationResult)
