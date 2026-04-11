"""Key frame extraction utility.

Extracts representative frames from video clips for thumbnails,
analysis, and display. Supports multiple strategies: uniform sampling,
scene-change-based, and content-aware (blur detection).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

try:
    import cv2
    import numpy as np

    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False
    logger.warning("opencv-python-headless not installed. Key frame extraction limited.")


@dataclass(frozen=True)
class KeyFrame:
    """A key frame extracted from a video."""

    frame_number: int
    timestamp: float
    path: str | None = None
    sharpness: float = 0.0


def _compute_sharpness(gray_frame) -> float:
    """Compute Laplacian-based sharpness score for a grayscale frame."""
    laplacian = cv2.Laplacian(gray_frame, cv2.CV_64F)
    return float(laplacian.var())


def extract_key_frames(
    video_path: str,
    output_dir: str,
    *,
    num_frames: int = 5,
    start_time: float = 0.0,
    end_time: float | None = None,
    strategy: str = "uniform",
) -> list[KeyFrame]:
    """Extract key frames from a video.

    Strategies:
    - "uniform": Evenly spaced frames across the clip.
    - "sharpest": Sample many frames, keep the sharpest ones.
    - "scene_change": Frames at scene-change boundaries.

    Falls back to returning empty list if OpenCV unavailable.
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    if not CV2_AVAILABLE:
        logger.warning("OpenCV unavailable. Cannot extract key frames from %s", video_path)
        return []

    try:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            logger.error("Could not open video: %s", video_path)
            return []

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        start_frame = int(start_time * fps)
        end_frame = int(end_time * fps) if end_time else total_frames
        end_frame = min(end_frame, total_frames)

        if strategy == "sharpest":
            return _extract_sharpest(cap, output_path, start_frame, end_frame, fps, num_frames)
        elif strategy == "scene_change":
            return _extract_scene_change(cap, output_path, start_frame, end_frame, fps, num_frames)
        else:
            return _extract_uniform(cap, output_path, start_frame, end_frame, fps, num_frames)

    except Exception:
        logger.exception("Key frame extraction failed for %s", video_path)
        return []


def _extract_uniform(
    cap, output_path: Path, start: int, end: int, fps: float, count: int,
) -> list[KeyFrame]:
    """Extract evenly spaced frames."""
    span = end - start
    if span <= 0 or count <= 0:
        cap.release()
        return []

    interval = max(1, span // count)
    results: list[KeyFrame] = []

    for i in range(count):
        frame_num = start + i * interval
        if frame_num >= end:
            break

        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
        ret, frame = cap.read()
        if not ret:
            continue

        timestamp = frame_num / fps
        path = str(output_path / f"keyframe_{i:04d}.jpg")
        cv2.imwrite(path, frame)

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        sharpness = _compute_sharpness(gray)

        results.append(KeyFrame(
            frame_number=frame_num,
            timestamp=round(timestamp, 3),
            path=path,
            sharpness=round(sharpness, 2),
        ))

    cap.release()
    logger.info("Extracted %d uniform key frames", len(results))
    return results


def _extract_sharpest(
    cap, output_path: Path, start: int, end: int, fps: float, count: int,
) -> list[KeyFrame]:
    """Sample many frames and keep the sharpest."""
    sample_count = min(count * 5, end - start)
    interval = max(1, (end - start) // sample_count)
    candidates: list[tuple[int, float, object]] = []

    for i in range(sample_count):
        frame_num = start + i * interval
        if frame_num >= end:
            break
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
        ret, frame = cap.read()
        if not ret:
            continue
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        sharpness = _compute_sharpness(gray)
        candidates.append((frame_num, sharpness, frame))

    # Sort by sharpness descending, pick top N
    candidates.sort(key=lambda c: c[1], reverse=True)
    selected = candidates[:count]
    selected.sort(key=lambda c: c[0])  # Re-sort by time

    results: list[KeyFrame] = []
    for idx, (frame_num, sharpness, frame) in enumerate(selected):
        path = str(output_path / f"keyframe_{idx:04d}.jpg")
        cv2.imwrite(path, frame)
        results.append(KeyFrame(
            frame_number=frame_num,
            timestamp=round(frame_num / fps, 3),
            path=path,
            sharpness=round(sharpness, 2),
        ))

    cap.release()
    logger.info("Extracted %d sharpest key frames", len(results))
    return results


def _extract_scene_change(
    cap, output_path: Path, start: int, end: int, fps: float, count: int,
) -> list[KeyFrame]:
    """Extract frames at scene-change boundaries."""
    sample_interval = max(1, int(fps / 4))  # Check 4x per second
    prev_gray = None
    diffs: list[tuple[int, float]] = []

    frame_idx = start
    cap.set(cv2.CAP_PROP_POS_FRAMES, start)

    while frame_idx < end:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_idx % sample_interval == 0:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            gray = cv2.GaussianBlur(gray, (21, 21), 0)
            if prev_gray is not None:
                diff = float(np.mean(cv2.absdiff(prev_gray, gray)))
                diffs.append((frame_idx, diff))
            prev_gray = gray
        frame_idx += 1

    # Pick frames with highest scene-change scores
    diffs.sort(key=lambda d: d[1], reverse=True)
    selected_frames = [d[0] for d in diffs[:count]]
    selected_frames.sort()

    results: list[KeyFrame] = []
    for idx, frame_num in enumerate(selected_frames):
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
        ret, frame = cap.read()
        if not ret:
            continue
        path = str(output_path / f"keyframe_{idx:04d}.jpg")
        cv2.imwrite(path, frame)
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        sharpness = _compute_sharpness(gray)
        results.append(KeyFrame(
            frame_number=frame_num,
            timestamp=round(frame_num / fps, 3),
            path=path,
            sharpness=round(sharpness, 2),
        ))

    cap.release()
    logger.info("Extracted %d scene-change key frames", len(results))
    return results
