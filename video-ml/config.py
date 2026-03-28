"""Pipeline configuration using Pydantic BaseModel.

Central configuration for all pipeline stages, paths, processing
parameters, play types, and actions.
"""

from __future__ import annotations

from pathlib import Path
from typing import ClassVar

from pydantic import BaseModel, Field


class PipelineConfig(BaseModel):
    """Main configuration for the video ML pipeline."""

    # --- Paths ---
    data_dir: Path = Field(default=Path("data/clips"))
    film_db_path: Path = Field(default=Path("data/film.db"))
    basketball_db_path: Path = Field(default=Path("data/basketball.db"))
    temp_dir: Path = Field(default=Path("data/temp"))

    # --- Processing parameters ---
    target_fps: float = Field(default=2.0, description="FPS for frame extraction during analysis")
    min_clip_duration: float = Field(default=6.0, description="Minimum clip length in seconds")
    max_clip_duration: float = Field(default=30.0, description="Maximum clip length in seconds")
    clip_padding: float = Field(default=1.0, description="Extra seconds before/after detected segment")
    scene_change_threshold: float = Field(
        default=30.0,
        description="Mean absolute difference threshold for scene change detection",
    )
    confidence_threshold: float = Field(
        default=0.5,
        description="Minimum confidence for classification results",
    )
    thumbnail_width: int = Field(default=320, description="Thumbnail width in pixels")
    thumbnail_height: int = Field(default=180, description="Thumbnail height in pixels")
    embedding_dim: int = Field(default=512, description="Dimensionality of clip embeddings")
    batch_size: int = Field(default=16, description="Batch size for model inference")

    # --- Play types ---
    PLAY_TYPES: ClassVar[list[str]] = [
        "isolation",
        "pick_and_roll",
        "pick_and_pop",
        "post_up",
        "spot_up",
        "handoff",
        "cut",
        "off_screen",
        "transition",
        "putback",
        "miscellaneous",
    ]

    # --- Primary actions ---
    ACTIONS: ClassVar[list[str]] = [
        "drive",
        "pull_up_jumper",
        "catch_and_shoot",
        "floater",
        "layup",
        "dunk",
        "hook_shot",
        "fadeaway",
        "stepback",
        "euro_step",
        "pass",
        "screen",
        "rebound",
        "steal",
        "block",
        "turnover",
        "free_throw",
    ]

    # --- Shot results ---
    SHOT_RESULTS: ClassVar[list[str]] = [
        "made",
        "missed",
        "blocked",
        "fouled",
        "and_one",
    ]

    # --- Source types ---
    SOURCE_TYPES: ClassVar[list[str]] = [
        "upload",
        "youtube",
        "local",
        "stream",
    ]

    def ensure_directories(self) -> None:
        """Create all required directories if they don't exist."""
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self.film_db_path.parent.mkdir(parents=True, exist_ok=True)
        self.basketball_db_path.parent.mkdir(parents=True, exist_ok=True)
