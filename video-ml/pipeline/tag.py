"""Auto-tagging engine.

Generates tags from classification results, detection data, and
alignment metadata. Tags are categorized for filtering in the frontend.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from config import PipelineConfig
from models.schemas import ClassificationResult, ClipSegment, DetectionResult

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Tag:
    """A generated tag with category and confidence."""

    name: str
    category: str  # action, player, team, context, quality, custom
    confidence: float = 1.0


def generate_tags(
    classification: ClassificationResult,
    segment: ClipSegment,
    detections: list[DetectionResult] | None = None,
    *,
    home_team: str | None = None,
    away_team: str | None = None,
) -> list[Tag]:
    """Generate tags from classification and detection results.

    Produces categorized tags for:
    - Play type and action (action category)
    - Players involved (player category)
    - Teams (team category)
    - Contextual info: quarter, clock, score (context category)
    - Quality indicators (quality category)
    """
    tags: list[Tag] = []

    # --- Action tags ---
    if classification.play_type and classification.play_type != "miscellaneous":
        tags.append(
            Tag(
                name=classification.play_type.replace("_", " "),
                category="action",
                confidence=classification.confidence,
            )
        )

    if classification.primary_action:
        tags.append(
            Tag(
                name=classification.primary_action.replace("_", " "),
                category="action",
                confidence=classification.confidence,
            )
        )

    # --- Player tags ---
    if classification.primary_player:
        tags.append(
            Tag(
                name=classification.primary_player,
                category="player",
                confidence=classification.confidence,
            )
        )

    # --- Team tags ---
    if home_team:
        tags.append(Tag(name=home_team, category="team", confidence=0.8))
    if away_team:
        tags.append(Tag(name=away_team, category="team", confidence=0.8))

    # --- Context tags ---
    if segment.quarter is not None:
        label = f"Q{segment.quarter}" if segment.quarter <= 4 else f"OT{segment.quarter - 4}"
        tags.append(Tag(name=label, category="context"))

    if segment.game_clock:
        tags.append(Tag(name=f"clock {segment.game_clock}", category="context"))

    # Duration-based context
    if segment.duration > 15.0:
        tags.append(Tag(name="long possession", category="context", confidence=0.9))
    elif segment.duration < 5.0:
        tags.append(Tag(name="quick play", category="context", confidence=0.9))

    # --- Quality tags from detections ---
    if detections:
        avg_objects = sum(len(d.objects) for d in detections) / max(len(detections), 1)
        court_ratio = sum(1 for d in detections if d.court_detected) / max(len(detections), 1)

        if court_ratio > 0.8:
            tags.append(Tag(name="clear court view", category="quality", confidence=court_ratio))
        if avg_objects > 8:
            tags.append(Tag(name="crowded frame", category="quality", confidence=0.7))

    # --- Carry forward explicit tags from classification ---
    existing_names = {t.name for t in tags}
    for raw_tag in classification.tags:
        clean = raw_tag.replace("_", " ")
        if clean not in existing_names:
            tags.append(
                Tag(
                    name=clean,
                    category="custom",
                    confidence=classification.confidence,
                )
            )
            existing_names.add(clean)

    logger.info("Generated %d tags for clip_id=%s", len(tags), classification.clip_id)
    return tags
