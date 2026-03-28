"""Pydantic models for the video ML pipeline.

All data flowing between pipeline stages is typed through these schemas.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class VideoMetadata(BaseModel):
    """Metadata extracted from a video file."""

    title: str = ""
    duration: float = Field(default=0.0, description="Duration in seconds")
    width: int = Field(default=0, description="Frame width in pixels")
    height: int = Field(default=0, description="Frame height in pixels")
    fps: float = Field(default=0.0, description="Frames per second")
    file_size: int = Field(default=0, description="File size in bytes")
    source_type: str = Field(
        default="local",
        description="One of: upload, youtube, local, stream",
    )


class DetectedObject(BaseModel):
    """A single detected object in a frame."""

    label: str = Field(description="Object class label (e.g. 'player', 'ball', 'hoop')")
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    bbox: tuple[float, float, float, float] = Field(
        default=(0.0, 0.0, 0.0, 0.0),
        description="Bounding box as (x1, y1, x2, y2) normalized [0,1]",
    )


class ClipSegment(BaseModel):
    """A segment of video identified as a distinct clip/possession."""

    start_time: float = Field(description="Start time in seconds")
    end_time: float = Field(description="End time in seconds")
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    quarter: int | None = Field(default=None, description="Game quarter (1-4, 5+ for OT)")
    game_clock: str | None = Field(default=None, description="Game clock at start, e.g. '8:42'")

    @property
    def duration(self) -> float:
        return self.end_time - self.start_time


class DetectionResult(BaseModel):
    """Detection results for a single frame."""

    frame_number: int = Field(description="Frame index in the video")
    timestamp: float = Field(description="Timestamp in seconds")
    objects: list[DetectedObject] = Field(default_factory=list)
    court_detected: bool = Field(default=False)


class ClassificationResult(BaseModel):
    """Classification of a clip's basketball action."""

    clip_id: int | None = Field(default=None)
    play_type: str = Field(default="miscellaneous")
    primary_action: str = Field(default="")
    primary_player: str | None = Field(default=None)
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    tags: list[str] = Field(default_factory=list)


class ProcessingResult(BaseModel):
    """Summary of a full video processing run."""

    video_id: int
    clips_found: int = 0
    clips_classified: int = 0
    tags_generated: int = 0
    processing_time: float = Field(default=0.0, description="Total processing time in seconds")
    errors: list[str] = Field(default_factory=list)
