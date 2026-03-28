"""Scoreboard text extraction (stub for MVP).

Will eventually use OCR (Tesseract / EasyOCR / PaddleOCR) to read
score, game clock, shot clock, and quarter from video frames.
For now, returns mock data.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ScoreboardReading:
    """Data read from a scoreboard in a video frame."""

    home_score: int | None = None
    away_score: int | None = None
    game_clock: str | None = None
    shot_clock: float | None = None
    quarter: int | None = None
    confidence: float = 0.0


def extract_scoreboard(frame=None) -> ScoreboardReading:
    """Extract scoreboard data from a video frame.

    Stub for MVP. Returns mock data regardless of input.
    Future implementation will:
    1. Detect scoreboard region via template matching or a trained detector
    2. Crop and preprocess the scoreboard region
    3. Run OCR to extract text
    4. Parse structured data from OCR output
    """
    if frame is None:
        return ScoreboardReading(confidence=0.0)

    # TODO: Real OCR implementation
    logger.info("Scoreboard OCR is a stub -- returning mock data")
    return ScoreboardReading(
        home_score=105,
        away_score=98,
        game_clock="4:32",
        shot_clock=14.0,
        quarter=3,
        confidence=0.1,
    )


def extract_scoreboard_from_frames(frames: list) -> list[ScoreboardReading]:
    """Extract scoreboard data from multiple frames.

    Averages readings for more robust results.
    """
    return [extract_scoreboard(f) for f in frames]


def detect_scoreboard_region(frame) -> tuple[int, int, int, int] | None:
    """Detect the bounding box of the scoreboard overlay.

    Returns (x, y, width, height) or None if not detected.
    Stub for MVP.
    """
    if frame is None:
        return None

    # TODO: Template matching or learned detector
    # Scoreboards typically appear in the top-center or bottom of frame
    logger.info("Scoreboard region detection is a stub")
    return None
