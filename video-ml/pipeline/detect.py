"""Object detection using YOLO + supervision for basketball video analysis.

Uses ultralytics YOLOv8/11 for person/ball detection. Falls back to mock
results when models aren't available or video can't be read.

Hoop estimation is performed via court geometry when YOLO detects >= 3 players
but no physical hoop class is available in the COCO label set.
"""

from __future__ import annotations

import logging
import random
import threading
from pathlib import Path

from config import PipelineConfig
from models.schemas import ClipSegment, DetectedObject, DetectionResult

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Optional dependency checks
# ---------------------------------------------------------------------------
try:
    from ultralytics import YOLO  # type: ignore[import-untyped]

    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    logger.warning("ultralytics not installed — using mock detection.")

try:
    import cv2
    import numpy as np

    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False

# ---------------------------------------------------------------------------
# COCO class IDs relevant to basketball
# ---------------------------------------------------------------------------
PERSON_CLASS = 0
SPORTS_BALL_CLASS = 32

# Minimum players visible before we synthesise a hoop estimate
_MIN_PLAYERS_FOR_HOOP = 3
# Confidence assigned to the synthetic hoop detection
_HOOP_SYNTHETIC_CONFIDENCE = 0.55
# Hoop sits in the top ~10 % of the frame vertically
_HOOP_Y_TOP = 0.03
_HOOP_Y_BOTTOM = 0.10
# Half-width of the synthetic hoop bbox (normalised)
_HOOP_HALF_WIDTH = 0.025

# Load model lazily (singleton, thread-safe)
_model_cache: dict[str, object] = {}
_model_cache_lock = threading.Lock()

# ---------------------------------------------------------------------------
# Model path resolution
# ---------------------------------------------------------------------------
_VIDEO_ML_DIR = Path(__file__).resolve().parent.parent


def _get_yolo_model(model_name: str = "yolo11n.pt") -> object:
    """Load YOLO model, cached globally (thread-safe).

    Resolves *model_name* relative to the video-ml project root so that the
    weight file is found regardless of the caller's working directory.
    """
    with _model_cache_lock:
        if model_name not in _model_cache:
            model_path = _VIDEO_ML_DIR / model_name
            if not model_path.exists():
                raise FileNotFoundError(
                    f"YOLO weight file not found at {model_path}"
                )
            logger.info("Loading YOLO model: %s", model_path)
            _model_cache[model_name] = YOLO(str(model_path))
    return _model_cache[model_name]


# ---------------------------------------------------------------------------
# Hoop estimation from court geometry
# ---------------------------------------------------------------------------

def _estimate_hoop(
    players: list[DetectedObject],
) -> DetectedObject | None:
    """Estimate hoop position from player bounding boxes.

    When >= ``_MIN_PLAYERS_FOR_HOOP`` players are visible we place a
    synthetic hoop bbox centred horizontally on the median player x-centre
    and in the top ~10 % of the frame.  This approximates the near-side
    basket under a typical broadcast camera angle.

    Returns ``None`` when there are too few players to make a reasonable
    estimate.
    """
    if len(players) < _MIN_PLAYERS_FOR_HOOP:
        return None

    # Compute the horizontal centre of each player bbox
    x_centres = sorted(
        (p.bbox[0] + p.bbox[2]) / 2.0 for p in players
    )
    median_x = x_centres[len(x_centres) // 2]

    # Clamp so the hoop bbox stays within [0, 1]
    hoop_x1 = max(0.0, median_x - _HOOP_HALF_WIDTH)
    hoop_x2 = min(1.0, median_x + _HOOP_HALF_WIDTH)

    return DetectedObject(
        label="hoop",
        confidence=round(_HOOP_SYNTHETIC_CONFIDENCE, 3),
        bbox=(
            round(hoop_x1, 3),
            round(_HOOP_Y_TOP, 3),
            round(hoop_x2, 3),
            round(_HOOP_Y_BOTTOM, 3),
        ),
    )


# ---------------------------------------------------------------------------
# Real YOLO detection
# ---------------------------------------------------------------------------

def _real_detection(
    video_path: str,
    segment: ClipSegment,
    config: PipelineConfig,
) -> list[DetectionResult]:
    """Run real YOLO detection on video frames within the clip segment.

    Uses ``cv2.CAP_PROP_POS_FRAMES`` to seek directly to each sample frame
    instead of reading and discarding intermediate frames.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        logger.error("Could not open video: %s", video_path)
        return []

    try:
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        model = _get_yolo_model()

        # Frame range for this segment
        sample_interval = max(1, int(fps / config.target_fps))
        start_frame = int(segment.start_time * fps)
        end_frame = min(int(segment.end_time * fps), total_frames)

        results: list[DetectionResult] = []
        frame_idx = start_frame

        while frame_idx < end_frame:
            # Seek directly to the target frame (skip intermediate frames)
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            if not ret:
                break

            timestamp = frame_idx / fps

            # Run YOLO inference (low conf threshold for recall)
            preds = model.predict(frame, conf=0.25, verbose=False)

            objects: list[DetectedObject] = []
            players: list[DetectedObject] = []
            court_detected = False

            if preds and len(preds) > 0:
                boxes = preds[0].boxes
                if boxes is not None:
                    for i in range(len(boxes)):
                        cls_id = int(boxes.cls[i].item())
                        conf = float(boxes.conf[i].item())
                        x1, y1, x2, y2 = boxes.xyxyn[i].tolist()

                        if cls_id == PERSON_CLASS:
                            player = DetectedObject(
                                label="player",
                                confidence=round(conf, 3),
                                bbox=(
                                    round(x1, 3),
                                    round(y1, 3),
                                    round(x2, 3),
                                    round(y2, 3),
                                ),
                            )
                            objects.append(player)
                            players.append(player)
                            court_detected = True
                        elif cls_id == SPORTS_BALL_CLASS:
                            objects.append(
                                DetectedObject(
                                    label="ball",
                                    confidence=round(conf, 3),
                                    bbox=(
                                        round(x1, 3),
                                        round(y1, 3),
                                        round(x2, 3),
                                        round(y2, 3),
                                    ),
                                )
                            )

            # Synthesise hoop from court geometry when YOLO can't detect one
            hoop = _estimate_hoop(players)
            if hoop is not None:
                objects.append(hoop)

            results.append(
                DetectionResult(
                    frame_number=frame_idx,
                    timestamp=round(timestamp, 3),
                    objects=objects,
                    court_detected=court_detected,
                )
            )

            frame_idx += sample_interval
    finally:
        cap.release()

    logger.info(
        "YOLO detection: %d frames analysed for clip %.1f-%.1fs, %d total objects",
        len(results),
        segment.start_time,
        segment.end_time,
        sum(len(r.objects) for r in results),
    )
    return results


# ---------------------------------------------------------------------------
# Mock fallback
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def detect_objects_in_clip(
    video_path: Path,
    segment: ClipSegment,
    config: PipelineConfig | None = None,
) -> list[DetectionResult]:
    """Run object detection on frames within a clip segment.

    Uses YOLO when available + video is readable. Falls back to mock.
    """
    if config is None:
        config = PipelineConfig()

    # Try real detection first
    if YOLO_AVAILABLE and CV2_AVAILABLE and video_path.exists():
        try:
            results = _real_detection(str(video_path), segment, config)
            if results:
                return results
            logger.warning(
                "YOLO returned 0 results for %s — falling back to mock",
                video_path,
            )
        except Exception:
            logger.exception("YOLO detection failed, falling back to mock")

    # Fallback to mock
    fps = config.target_fps
    num_frames = max(1, int(segment.duration * fps))

    results: list[DetectionResult] = []
    for i in range(num_frames):
        timestamp = segment.start_time + (i / fps)
        frame_number = int(timestamp * 30)
        results.append(_mock_detection_for_frame(frame_number, timestamp))

    logger.info(
        "Mock detection produced %d frame results for clip %.1f-%.1fs",
        len(results),
        segment.start_time,
        segment.end_time,
    )
    return results
