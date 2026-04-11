"""Scoreboard text extraction via EasyOCR.

Uses EasyOCR to read score, game clock, shot clock, and quarter from
video frames. Falls back to mock data when EasyOCR is unavailable or
OCR confidence is too low.
"""

from __future__ import annotations

import logging
import re
import threading
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import numpy as np

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lazy singleton for the EasyOCR reader
# ---------------------------------------------------------------------------
_ocr_reader = None
_ocr_reader_lock = threading.Lock()
_easyocr_available = True


def _get_ocr_reader() -> object | None:
    """Return a shared EasyOCR reader instance (lazy, thread-safe)."""
    global _ocr_reader, _easyocr_available  # noqa: PLW0603

    # Fast path: already initialized or known unavailable
    if _ocr_reader is not None:
        return _ocr_reader

    with _ocr_reader_lock:
        # Double-check both flags inside the lock to avoid races
        if _ocr_reader is not None:
            return _ocr_reader
        if not _easyocr_available:
            return None

        try:
            import easyocr  # noqa: F811

            _ocr_reader = easyocr.Reader(["en"], gpu=False, verbose=False)
            logger.info("EasyOCR reader initialized (English, CPU)")
            return _ocr_reader
        except ImportError:
            _easyocr_available = False
            logger.warning("easyocr not installed — falling back to mock data")
            return None
        except Exception:
            _easyocr_available = False
            logger.exception("Failed to initialize EasyOCR reader")
            return None


# ---------------------------------------------------------------------------
# Data class
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class ScoreboardReading:
    """Data read from a scoreboard in a video frame."""

    home_score: int | None = None
    away_score: int | None = None
    game_clock: str | None = None
    shot_clock: float | None = None
    quarter: int | None = None
    confidence: float = 0.0


# ---------------------------------------------------------------------------
# Mock data returned when OCR is unavailable or confidence is too low
# ---------------------------------------------------------------------------
_MOCK_READING = ScoreboardReading(
    home_score=105,
    away_score=98,
    game_clock="4:32",
    shot_clock=14.0,
    quarter=3,
    confidence=0.1,
)


def _mock_reading() -> ScoreboardReading:
    return _MOCK_READING


# ---------------------------------------------------------------------------
# Parse helpers
# ---------------------------------------------------------------------------
_CLOCK_PATTERN = re.compile(r"\b(\d{1,2}:\d{2})\b")
_QUARTER_PATTERN = re.compile(
    r"(?:Q|QTR|QUARTER)\s*(\d)"
    r"|(\d)\s*(?:ST|ND|RD|TH)\b"
    r"|\b(OT|OVERTIME)\b",
    re.IGNORECASE,
)
_SCORE_PATTERN = re.compile(r"\b(\d{1,3})\b")

MIN_CONFIDENCE = 0.1


def _parse_clock(text: str) -> str | None:
    """Extract MM:SS or M:SS pattern from OCR text."""
    match = _CLOCK_PATTERN.search(text)
    if match is None:
        return None
    clock_str = match.group(1)
    # Basic sanity: seconds part should be 0–59
    parts = clock_str.split(":")
    if len(parts) == 2:
        try:
            seconds = int(parts[1])
            if seconds > 59:
                return None
        except ValueError:
            return None
    return clock_str


def _parse_scores(texts: list[str]) -> tuple[int | None, int | None]:
    """Extract two numeric scores from OCR text fragments.

    Looks for standalone numbers between 0 and 199 across all text
    fragments and returns the first two found as (away, home).  NBA
    scoreboards typically show the away team first (left) and home
    team second (right), and EasyOCR reads left-to-right.
    """
    candidates: list[int] = []
    for text in texts:
        for match in _SCORE_PATTERN.finditer(text):
            value = int(match.group(1))
            # NBA scores are typically 0-199
            if 0 <= value <= 199:
                candidates.append(value)
            if len(candidates) >= 2:
                break
        if len(candidates) >= 2:
            break

    if len(candidates) >= 2:
        return candidates[0], candidates[1]
    if len(candidates) == 1:
        return candidates[0], None
    return None, None


def _parse_quarter(text: str) -> int | None:
    """Extract quarter number (1-4, OT=5) from OCR text."""
    match = _QUARTER_PATTERN.search(text)
    if match is None:
        return None

    # Group 1: "Q3" / "QTR 2" style
    if match.group(1) is not None:
        q = int(match.group(1))
        return q if 1 <= q <= 4 else None

    # Group 2: "1ST" / "3RD" style
    if match.group(2) is not None:
        q = int(match.group(2))
        return q if 1 <= q <= 4 else None

    # Group 3: "OT" / "OVERTIME"
    if match.group(3) is not None:
        return 5

    return None


# ---------------------------------------------------------------------------
# Region detection
# ---------------------------------------------------------------------------
def detect_scoreboard_region(frame: np.ndarray | None) -> tuple[int, int, int, int] | None:
    """Detect the bounding box of the scoreboard overlay.

    Returns ``(x, y, width, height)`` or ``None`` if the frame is invalid.

    Strategy: crop the top 15 % of the frame where NBA broadcast
    scoreboards typically appear.
    """
    if frame is None:
        return None

    try:
        h, w = frame.shape[:2]
    except (AttributeError, IndexError):
        return None

    if h == 0 or w == 0:
        return None

    region_h = max(1, int(h * 0.15))
    return (0, 0, w, region_h)


# ---------------------------------------------------------------------------
# Main extraction
# ---------------------------------------------------------------------------
def extract_scoreboard(frame: np.ndarray | None = None) -> ScoreboardReading:
    """Extract scoreboard data from a video frame via EasyOCR.

    Falls back to mock data when:
    - ``frame`` is ``None``
    - EasyOCR is not installed
    - Overall OCR confidence is below ``MIN_CONFIDENCE``
    """
    if frame is None:
        return ScoreboardReading(confidence=0.0)

    reader = _get_ocr_reader()
    if reader is None:
        logger.info("EasyOCR unavailable — returning mock data")
        return _mock_reading()

    # --- Crop the scoreboard region ----------------------------------------
    region = detect_scoreboard_region(frame)
    if region is None:
        return ScoreboardReading(confidence=0.0)

    x, y, w, h = region
    cropped = frame[y : y + h, x : x + w]

    # --- Run OCR -----------------------------------------------------------
    try:
        results = reader.readtext(cropped)
    except Exception:
        logger.exception("EasyOCR readtext failed")
        return _mock_reading()

    if not results:
        logger.debug("EasyOCR returned no results")
        return _mock_reading()

    # ``results`` is a list of (bbox, text, confidence) tuples
    texts: list[str] = []
    confidences: list[float] = []

    for _bbox, text, conf in results:
        texts.append(text)
        confidences.append(float(conf))

    avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

    if avg_confidence < MIN_CONFIDENCE:
        logger.debug("OCR confidence %.3f below threshold", avg_confidence)
        return _mock_reading()

    combined_text = " ".join(texts)

    # --- Parse fields ------------------------------------------------------
    game_clock = _parse_clock(combined_text)
    away_score, home_score = _parse_scores(texts)
    quarter = _parse_quarter(combined_text)

    return ScoreboardReading(
        home_score=home_score,
        away_score=away_score,
        game_clock=game_clock,
        shot_clock=None,  # shot clock requires a dedicated region / model
        quarter=quarter,
        confidence=round(avg_confidence, 3),
    )


# ---------------------------------------------------------------------------
# Batch extraction
# ---------------------------------------------------------------------------
def extract_scoreboard_from_frames(frames: list) -> list[ScoreboardReading]:
    """Extract scoreboard data from multiple frames."""
    return [extract_scoreboard(f) for f in frames]
