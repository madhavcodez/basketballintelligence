"""Clip embedding generation.

Stub for MVP -- returns random vectors. When sentence-transformers or
a vision model is available, will generate real semantic embeddings.
"""

from __future__ import annotations

import hashlib
import logging
import struct

from config import PipelineConfig
from models.schemas import ClassificationResult, ClipSegment

logger = logging.getLogger(__name__)

try:
    import numpy as np

    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False
    logger.warning("numpy not installed. Embeddings will be zero vectors.")


def _deterministic_random_vector(seed: str, dim: int) -> list[float]:
    """Generate a deterministic pseudo-random unit vector from a seed string.

    Uses SHA-256 hashing so the same clip always gets the same embedding,
    making results reproducible.
    """
    h = hashlib.sha256(seed.encode()).digest()
    # Extend the hash to cover the full dimension
    extended = b""
    for i in range((dim * 4 // 32) + 1):
        extended += hashlib.sha256(h + struct.pack(">I", i)).digest()

    values: list[float] = []
    for i in range(dim):
        # Unpack 4 bytes as a float-ish value in [-1, 1]
        raw = struct.unpack(">I", extended[i * 4 : i * 4 + 4])[0]
        values.append((raw / 0xFFFFFFFF) * 2.0 - 1.0)

    # L2 normalize
    magnitude = sum(v * v for v in values) ** 0.5
    if magnitude > 0:
        values = [v / magnitude for v in values]

    return values


def generate_clip_embedding(
    segment: ClipSegment,
    classification: ClassificationResult | None = None,
    config: PipelineConfig | None = None,
    *,
    video_id: int | None = None,
) -> list[float]:
    """Generate an embedding vector for a clip.

    For MVP, returns a deterministic pseudo-random unit vector seeded by
    clip metadata, ensuring reproducibility. Real implementation will
    use a vision encoder or multimodal model.
    """
    if config is None:
        config = PipelineConfig()

    dim = config.embedding_dim

    # Build a seed from clip properties
    seed_parts = [
        f"start={segment.start_time}",
        f"end={segment.end_time}",
    ]
    if video_id is not None:
        seed_parts.append(f"vid={video_id}")
    if classification is not None:
        seed_parts.append(f"play={classification.play_type}")
        seed_parts.append(f"action={classification.primary_action}")

    seed = "|".join(seed_parts)

    if NUMPY_AVAILABLE:
        # Use numpy for faster computation
        rng = np.random.default_rng(
            int(hashlib.sha256(seed.encode()).hexdigest()[:16], 16)
        )
        vec = rng.standard_normal(dim).astype(np.float32)
        vec = vec / np.linalg.norm(vec)
        return vec.tolist()

    return _deterministic_random_vector(seed, dim)


def generate_batch_embeddings(
    segments: list[ClipSegment],
    classifications: list[ClassificationResult] | None = None,
    config: PipelineConfig | None = None,
    *,
    video_id: int | None = None,
) -> list[list[float]]:
    """Generate embeddings for multiple clips."""
    if classifications is None:
        classifications = [None] * len(segments)  # type: ignore[list-item]

    return [
        generate_clip_embedding(seg, cls, config, video_id=video_id)
        for seg, cls in zip(segments, classifications, strict=False)
    ]
