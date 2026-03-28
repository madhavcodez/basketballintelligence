"""Sync clips with play-by-play data.

Stub for MVP -- aligns clip timestamps with external play-by-play
records by quarter and game clock. Full implementation will use
dynamic time warping or similar techniques.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from models.schemas import ClassificationResult, ClipSegment

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PlayByPlayEvent:
    """A single play-by-play event from external data."""

    quarter: int
    game_clock: str  # e.g. "8:42"
    event_type: str  # e.g. "shot", "turnover", "foul"
    description: str
    player: str = ""
    team: str = ""
    home_score: int = 0
    away_score: int = 0


@dataclass(frozen=True)
class AlignmentResult:
    """Result of aligning a clip to a play-by-play event."""

    clip_segment: ClipSegment
    matched_event: PlayByPlayEvent | None
    alignment_confidence: float
    quarter: int | None = None
    game_clock: str | None = None
    score_home: int | None = None
    score_away: int | None = None


def _parse_game_clock_seconds(clock_str: str) -> float:
    """Convert a game clock string like '8:42' to total seconds."""
    try:
        parts = clock_str.split(":")
        if len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
        return float(clock_str)
    except (ValueError, IndexError):
        return 0.0


def align_clips_to_pbp(
    clips: list[ClipSegment],
    events: list[PlayByPlayEvent],
    *,
    quarter: int | None = None,
    quarter_start_offset: float = 0.0,
) -> list[AlignmentResult]:
    """Align clip segments to play-by-play events.

    For MVP, performs simple temporal matching: each clip is matched to
    the nearest event based on estimated game clock time.

    Args:
        clips: Segmented video clips with timestamps.
        events: Play-by-play events to match against.
        quarter: If known, only match against events in this quarter.
        quarter_start_offset: Video timestamp where the quarter begins.
    """
    if not events:
        logger.info("No play-by-play events provided; returning unaligned clips")
        return [
            AlignmentResult(
                clip_segment=clip,
                matched_event=None,
                alignment_confidence=0.0,
            )
            for clip in clips
        ]

    filtered_events = events
    if quarter is not None:
        filtered_events = [e for e in events if e.quarter == quarter]

    # Build a list of (event, estimated_video_time)
    event_times: list[tuple[PlayByPlayEvent, float]] = []
    for evt in filtered_events:
        # In basketball, game clock counts down from 12:00 (720s)
        clock_sec = _parse_game_clock_seconds(evt.game_clock)
        # Estimate video position: elapsed = 720 - clock_sec + offset
        elapsed = 720.0 - clock_sec + quarter_start_offset
        event_times.append((evt, elapsed))

    results: list[AlignmentResult] = []
    for clip in clips:
        clip_mid = (clip.start_time + clip.end_time) / 2.0

        best_event: PlayByPlayEvent | None = None
        best_diff = float("inf")

        for evt, evt_time in event_times:
            diff = abs(clip_mid - evt_time)
            if diff < best_diff:
                best_diff = diff
                best_event = evt

        # Confidence decays with temporal distance
        confidence = max(0.0, 1.0 - (best_diff / 60.0)) if best_event else 0.0

        results.append(
            AlignmentResult(
                clip_segment=clip,
                matched_event=best_event,
                alignment_confidence=round(confidence, 3),
                quarter=best_event.quarter if best_event else None,
                game_clock=best_event.game_clock if best_event else None,
                score_home=best_event.home_score if best_event else None,
                score_away=best_event.away_score if best_event else None,
            )
        )

    logger.info("Aligned %d clips to %d PBP events", len(results), len(events))
    return results
