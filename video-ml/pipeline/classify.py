"""Action classification with rule-based fallback.

For the MVP, uses heuristic rules based on detection results to classify
basketball actions. When a real model is loaded, defers to neural
classification.
"""

from __future__ import annotations

import logging
import random
from collections import Counter

from config import PipelineConfig
from models.schemas import ClassificationResult, DetectionResult

logger = logging.getLogger(__name__)


def _count_objects(detections: list[DetectionResult]) -> Counter[str]:
    """Count how often each object label appears across frames."""
    counts: Counter[str] = Counter()
    for det in detections:
        for obj in det.objects:
            counts[obj.label] += 1
    return counts


def _estimate_ball_movement(detections: list[DetectionResult]) -> float:
    """Estimate total ball movement across frames (normalized units)."""
    ball_positions: list[tuple[float, float]] = []
    for det in detections:
        for obj in det.objects:
            if obj.label == "ball":
                cx = (obj.bbox[0] + obj.bbox[2]) / 2
                cy = (obj.bbox[1] + obj.bbox[3]) / 2
                ball_positions.append((cx, cy))
                break

    if len(ball_positions) < 2:
        return 0.0

    total = 0.0
    for i in range(1, len(ball_positions)):
        dx = ball_positions[i][0] - ball_positions[i - 1][0]
        dy = ball_positions[i][1] - ball_positions[i - 1][1]
        total += (dx**2 + dy**2) ** 0.5

    return total


def _rule_based_classify(
    detections: list[DetectionResult],
    clip_duration: float,
) -> ClassificationResult:
    """Classify a clip using heuristic rules on detection data."""
    counts = _count_objects(detections)
    ball_movement = _estimate_ball_movement(detections)
    num_frames = len(detections)

    avg_players = counts.get("player", 0) / max(num_frames, 1)
    ball_visible_ratio = counts.get("ball", 0) / max(num_frames, 1)
    hoop_visible_ratio = counts.get("hoop", 0) / max(num_frames, 1)

    # Heuristic classification
    play_type = "miscellaneous"
    action = ""
    confidence = 0.3

    if clip_duration < 4.0 and hoop_visible_ratio > 0.5:
        play_type = "spot_up"
        action = "catch_and_shoot"
        confidence = 0.55
    elif ball_movement > 1.5 and avg_players > 5:
        play_type = "transition"
        action = "drive"
        confidence = 0.50
    elif ball_movement < 0.3 and hoop_visible_ratio > 0.3:
        play_type = "post_up"
        action = "hook_shot"
        confidence = 0.40
    elif avg_players > 7:
        play_type = "pick_and_roll"
        action = "drive"
        confidence = 0.45
    elif ball_visible_ratio < 0.3:
        play_type = "miscellaneous"
        action = "rebound"
        confidence = 0.25
    else:
        play_type = "isolation"
        action = "pull_up_jumper"
        confidence = 0.35

    tags = [play_type, action]
    if hoop_visible_ratio > 0.5:
        tags.append("near_basket")
    if ball_movement > 2.0:
        tags.append("fast_movement")
    if clip_duration > 15.0:
        tags.append("long_possession")

    return ClassificationResult(
        play_type=play_type,
        primary_action=action,
        confidence=round(confidence, 3),
        tags=tags,
    )


def classify_clip(
    detections: list[DetectionResult],
    clip_duration: float,
    config: PipelineConfig | None = None,
    *,
    clip_id: int | None = None,
) -> ClassificationResult:
    """Classify a clip's basketball action.

    Uses rule-based heuristics for MVP. Neural model integration
    will override this when available.
    """
    if config is None:
        config = PipelineConfig()

    result = _rule_based_classify(detections, clip_duration)

    # Attach clip_id if provided
    return result.model_copy(update={"clip_id": clip_id})
