"""Basic object detection stub.

For the MVP, returns mock detection results. When YOLO/ultralytics is
available, will run real inference.
"""

from __future__ import annotations

import logging
import random
from pathlib import Path

from config import PipelineConfig
from models.schemas import ClipSegment, DetectedObject, DetectionResult

logger = logging.getLogger(__name__)

# Check for real model availability
try:
    from ultralytics import YOLO  # type: ignore[import-untyped]

    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False


def _mock_detection_for_frame(frame_number: int, timestamp: float) -> DetectionResult:
    """Generate a plausible mock detection result for a single frame."""
    rng = random.Random(frame_number)

    num_players = rng.randint(3, 10)
    objects: list[DetectedObject] = []

    for i in range(num_players):
        x1 = rng.uniform(0.05, 0.85)
        y1 = rng.uniform(0.1, 0.7)
        w = rng.uniform(0.03, 0.08)
        h = rng.uniform(0.1, 0.25)
        objects.append(
            DetectedObject(
                label="player",
                confidence=rng.uniform(0.7, 0.99),
                bbox=(round(x1, 3), round(y1, 3), round(x1 + w, 3), round(y1 + h, 3)),
            )
        )

    # Ball detection (not always visible)
    if rng.random() > 0.3:
        bx = rng.uniform(0.2, 0.8)
        by = rng.uniform(0.1, 0.6)
        objects.append(
            DetectedObject(
                label="ball",
                confidence=rng.uniform(0.5, 0.95),
                bbox=(round(bx, 3), round(by, 3), round(bx + 0.02, 3), round(by + 0.02, 3)),
            )
        )

    # Hoop detection
    if rng.random() > 0.2:
        hx = rng.uniform(0.35, 0.65)
        objects.append(
            DetectedObject(
                label="hoop",
                confidence=rng.uniform(0.8, 0.99),
                bbox=(round(hx, 3), 0.05, round(hx + 0.05, 3), 0.12),
            )
        )

    return DetectionResult(
        frame_number=frame_number,
        timestamp=round(timestamp, 3),
        objects=objects,
        court_detected=rng.random() > 0.1,
    )


def detect_objects_in_clip(
    video_path: Path,
    segment: ClipSegment,
    config: PipelineConfig | None = None,
) -> list[DetectionResult]:
    """Run object detection on frames within a clip segment.

    Returns mock results for MVP. Will use YOLO when available.
    """
    if config is None:
        config = PipelineConfig()

    fps = config.target_fps
    num_frames = max(1, int(segment.duration * fps))

    results: list[DetectionResult] = []
    for i in range(num_frames):
        timestamp = segment.start_time + (i / fps)
        frame_number = int(timestamp * 30)  # Approximate original frame number
        results.append(_mock_detection_for_frame(frame_number, timestamp))

    logger.info(
        "Detection produced %d frame results for clip %.1f-%.1fs",
        len(results),
        segment.start_time,
        segment.end_time,
    )
    return results
