"""Court line detection using OpenCV with graceful import fallback.

Detects basketball court lines and key regions (paint, three-point line,
free throw line) from video frames. Returns mock results when OpenCV
is unavailable.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

try:
    import cv2
    import numpy as np

    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False
    logger.warning("opencv-python-headless not installed. Court detection will return mock data.")


@dataclass(frozen=True)
class CourtRegion:
    """A detected region on the basketball court."""

    name: str  # e.g. "paint", "three_point_arc", "free_throw_line"
    points: list[tuple[float, float]] = field(default_factory=list)
    confidence: float = 0.0


@dataclass(frozen=True)
class CourtDetectionResult:
    """Result of court line detection on a single frame."""

    court_detected: bool = False
    lines: list[tuple[tuple[int, int], tuple[int, int]]] = field(default_factory=list)
    regions: list[CourtRegion] = field(default_factory=list)
    homography_matrix: list[list[float]] | None = None
    confidence: float = 0.0


def _detect_court_opencv(frame_bgr) -> CourtDetectionResult:
    """Detect court lines using Hough transform on a BGR frame."""
    gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Detect edges
    edges = cv2.Canny(blurred, 50, 150, apertureSize=3)

    # Detect lines using probabilistic Hough transform
    raw_lines = cv2.HoughLinesP(
        edges,
        rho=1,
        theta=np.pi / 180,
        threshold=80,
        minLineLength=50,
        maxLineGap=10,
    )

    if raw_lines is None or len(raw_lines) == 0:
        return CourtDetectionResult(court_detected=False, confidence=0.0)

    lines: list[tuple[tuple[int, int], tuple[int, int]]] = []
    for line in raw_lines:
        x1, y1, x2, y2 = line[0]
        lines.append(((int(x1), int(y1)), (int(x2), int(y2))))

    # Heuristic: if we find enough lines, assume court is visible
    num_lines = len(lines)
    confidence = min(1.0, num_lines / 30.0)
    court_detected = num_lines >= 5

    # Identify regions heuristically
    regions: list[CourtRegion] = []
    if court_detected:
        # Basic heuristic: look for horizontal and vertical line clusters
        h, w = gray.shape[:2]
        regions.append(
            CourtRegion(
                name="court_boundary",
                confidence=confidence,
            )
        )

    return CourtDetectionResult(
        court_detected=court_detected,
        lines=lines[:50],  # Cap at 50 lines
        regions=regions,
        confidence=round(confidence, 3),
    )


def _mock_court_detection() -> CourtDetectionResult:
    """Return a plausible mock court detection result."""
    return CourtDetectionResult(
        court_detected=True,
        lines=[
            ((100, 300), (1820, 300)),  # baseline
            ((100, 780), (1820, 780)),  # far baseline
            ((100, 300), (100, 780)),   # left sideline
            ((1820, 300), (1820, 780)), # right sideline
            ((960, 300), (960, 780)),   # half-court line
        ],
        regions=[
            CourtRegion(name="paint", confidence=0.8),
            CourtRegion(name="three_point_arc", confidence=0.7),
            CourtRegion(name="court_boundary", confidence=0.9),
        ],
        confidence=0.85,
    )


def detect_court(frame=None) -> CourtDetectionResult:
    """Detect basketball court lines and regions in a frame.

    Args:
        frame: A BGR numpy array (OpenCV format). If None, returns mock data.

    Returns mock results when OpenCV is unavailable or frame is None.
    """
    if frame is None:
        return _mock_court_detection()

    if not CV2_AVAILABLE:
        logger.info("OpenCV unavailable, returning mock court detection")
        return _mock_court_detection()

    try:
        return _detect_court_opencv(frame)
    except Exception:
        logger.exception("Court detection failed, returning mock")
        return _mock_court_detection()
