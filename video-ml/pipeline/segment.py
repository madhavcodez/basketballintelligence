"""Scene / possession detection using frame differencing.

Splits a video into clip segments by detecting scene changes. Uses OpenCV
for frame differencing when available, falls back to uniform splitting.
"""

from __future__ import annotations

import logging
from pathlib import Path

from config import PipelineConfig
from models.schemas import ClipSegment

logger = logging.getLogger(__name__)

# Attempt OpenCV import
try:
    import cv2
    import numpy as np

    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False
    logger.warning("opencv-python-headless not installed. Using fallback segmentation.")


def _segment_with_opencv(
    video_path: str,
    config: PipelineConfig,
) -> list[ClipSegment]:
    """Detect scene changes using frame differencing with OpenCV."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        logger.error("Could not open video: %s", video_path)
        return []

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps

    # Sample at the configured analysis FPS
    sample_interval = max(1, int(fps / config.target_fps))

    segments: list[ClipSegment] = []
    prev_frame_gray = None
    segment_start = 0.0
    frame_idx = 0

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % sample_interval == 0:
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                gray = cv2.GaussianBlur(gray, (21, 21), 0)

                if prev_frame_gray is not None:
                    diff = cv2.absdiff(prev_frame_gray, gray)
                    mean_diff = float(np.mean(diff))

                    if mean_diff > config.scene_change_threshold:
                        current_time = frame_idx / fps
                        clip_duration = current_time - segment_start

                        if config.min_clip_duration <= clip_duration <= config.max_clip_duration:
                            segments.append(
                                ClipSegment(
                                    start_time=round(segment_start, 2),
                                    end_time=round(current_time, 2),
                                    confidence=min(1.0, mean_diff / 100.0),
                                )
                            )

                        segment_start = current_time

                prev_frame_gray = gray

            frame_idx += 1
    finally:
        cap.release()

    # Capture the final segment
    final_time = total_frames / fps
    final_duration = final_time - segment_start
    if config.min_clip_duration <= final_duration <= config.max_clip_duration:
        segments.append(
            ClipSegment(
                start_time=round(segment_start, 2),
                end_time=round(final_time, 2),
                confidence=0.5,
            )
        )

    logger.info("OpenCV segmentation found %d clips in %s", len(segments), video_path)
    return segments


def _segment_uniform_fallback(
    duration: float,
    config: PipelineConfig,
) -> list[ClipSegment]:
    """Fallback: split into uniform segments when OpenCV is unavailable."""
    clip_len = 10.0  # Default 10-second clips
    segments: list[ClipSegment] = []
    current = 0.0

    while current + config.min_clip_duration <= duration:
        end = min(current + clip_len, duration)
        segments.append(
            ClipSegment(
                start_time=round(current, 2),
                end_time=round(end, 2),
                confidence=0.3,
            )
        )
        current = end

    logger.info("Uniform fallback segmentation produced %d clips", len(segments))
    return segments


def segment_video(
    video_path: Path,
    config: PipelineConfig | None = None,
    *,
    duration_hint: float | None = None,
) -> list[ClipSegment]:
    """Segment a video into clips.

    Uses OpenCV frame differencing when available. Falls back to uniform
    splitting using the provided duration_hint (or 120s default).
    """
    if config is None:
        config = PipelineConfig()

    if CV2_AVAILABLE:
        try:
            segments = _segment_with_opencv(str(video_path), config)
        except Exception:
            logger.exception("OpenCV segmentation failed, using fallback")
            fallback_duration = duration_hint if duration_hint is not None else 120.0
            segments = _segment_uniform_fallback(fallback_duration, config)
    else:
        fallback_duration = duration_hint if duration_hint is not None else 120.0
        segments = _segment_uniform_fallback(fallback_duration, config)

    # Apply padding: add extra time before and after each segment
    padding = getattr(config, 'clip_padding', 1.0)
    if padding > 0:
        total_duration = duration_hint or 9999.0
        for i, seg in enumerate(segments):
            segments[i] = ClipSegment(
                start_time=round(max(0, seg.start_time - padding), 2),
                end_time=round(min(total_duration, seg.end_time + padding), 2),
                confidence=seg.confidence,
                quarter=seg.quarter,
                game_clock=seg.game_clock,
            )

    return segments
