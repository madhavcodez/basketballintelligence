"""Clip embedding generation.

Uses sentence-transformers (all-MiniLM-L6-v2) for real semantic embeddings.
Falls back to deterministic pseudo-random vectors when the library is not
installed.
"""

from __future__ import annotations

import hashlib
import logging
import struct
import threading

from config import PipelineConfig
from models.schemas import ClassificationResult, ClipSegment

logger = logging.getLogger(__name__)

try:
    import numpy as np

    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False
    logger.warning("numpy not installed. Embeddings will be zero vectors.")

# ---------------------------------------------------------------------------
# Sentence-transformers availability + lazy singleton
# ---------------------------------------------------------------------------

try:
    from sentence_transformers import SentenceTransformer  # type: ignore[import-untyped]

    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False
    logger.info(
        "sentence-transformers not installed — using deterministic fallback embeddings."
    )

_MODEL_NAME = "all-MiniLM-L6-v2"
_MODEL_DIM = 384
_model_cache: dict[str, object] = {}
_model_cache_lock = threading.Lock()


def _get_sentence_model(model_name: str = _MODEL_NAME) -> SentenceTransformer:  # type: ignore[name-defined]
    """Load sentence-transformer model, cached globally (thread-safe)."""
    with _model_cache_lock:
        if model_name not in _model_cache:
            logger.info("Loading sentence-transformer model: %s", model_name)
            _model_cache[model_name] = SentenceTransformer(model_name)
    return _model_cache[model_name]  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Text description builder
# ---------------------------------------------------------------------------


def _build_clip_text(
    segment: ClipSegment,
    classification: ClassificationResult | None,
) -> str:
    """Build a descriptive text string from clip metadata for embedding.

    Format: "{play_type} {primary_action} basketball clip, {duration}s, quarter {quarter}"
    with optional player name and tags.
    """
    if classification is None:
        return f"basketball clip, {segment.duration:.1f}s"

    parts: list[str] = []

    # Core description
    play_type = classification.play_type or "miscellaneous"
    primary_action = classification.primary_action or ""
    core = f"{play_type} {primary_action}".strip()
    parts.append(f"{core} basketball clip")

    # Duration
    parts.append(f"{segment.duration:.1f}s")

    # Quarter
    if segment.quarter is not None:
        parts.append(f"quarter {segment.quarter}")

    description = ", ".join(parts)

    # Player name
    if classification.primary_player:
        description += f", player {classification.primary_player}"

    # Tags
    if classification.tags:
        description += f", {' '.join(classification.tags)}"

    return description


# ---------------------------------------------------------------------------
# Padding helper
# ---------------------------------------------------------------------------


def _pad_to_dim(vector: list[float], target_dim: int) -> list[float]:
    """Pad a vector with zeros to reach target_dim, preserving unit norm."""
    current_dim = len(vector)
    if current_dim >= target_dim:
        return vector[:target_dim]
    return vector + [0.0] * (target_dim - current_dim)


# ---------------------------------------------------------------------------
# Deterministic fallback (unchanged)
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Fallback embedding (uses numpy or pure-python deterministic vector)
# ---------------------------------------------------------------------------


def _fallback_embedding(
    segment: ClipSegment,
    classification: ClassificationResult | None,
    dim: int,
    video_id: int | None,
) -> list[float]:
    """Generate a fallback deterministic pseudo-random embedding."""
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
        rng = np.random.default_rng(
            int(hashlib.sha256(seed.encode()).hexdigest()[:16], 16)
        )
        vec = rng.standard_normal(dim).astype(np.float32)
        vec = vec / np.linalg.norm(vec)
        return vec.tolist()

    return _deterministic_random_vector(seed, dim)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def generate_clip_embedding(
    segment: ClipSegment,
    classification: ClassificationResult | None = None,
    config: PipelineConfig | None = None,
    *,
    video_id: int | None = None,
) -> list[float]:
    """Generate an embedding vector for a clip.

    When sentence-transformers is available, encodes a text description built
    from clip metadata using all-MiniLM-L6-v2 (384-dim), then zero-pads to
    config.embedding_dim (512).  Falls back to deterministic pseudo-random
    vectors otherwise.
    """
    if config is None:
        config = PipelineConfig()

    dim = config.embedding_dim

    if not SENTENCE_TRANSFORMERS_AVAILABLE:
        return _fallback_embedding(segment, classification, dim, video_id)

    text = _build_clip_text(segment, classification)
    model = _get_sentence_model()
    raw_vector: list[float] = model.encode(text, normalize_embeddings=True).tolist()

    return _pad_to_dim(raw_vector, dim)


def generate_batch_embeddings(
    segments: list[ClipSegment],
    classifications: list[ClassificationResult] | None = None,
    config: PipelineConfig | None = None,
    *,
    video_id: int | None = None,
) -> list[list[float]]:
    """Generate embeddings for multiple clips.

    When sentence-transformers is available, encodes all texts in a single
    batch call for efficiency.
    """
    if config is None:
        config = PipelineConfig()

    dim = config.embedding_dim

    if classifications is None:
        classifications = [None] * len(segments)  # type: ignore[list-item]

    # Fallback path: generate one-by-one with deterministic vectors
    if not SENTENCE_TRANSFORMERS_AVAILABLE:
        return [
            _fallback_embedding(seg, cls, dim, video_id)
            for seg, cls in zip(segments, classifications, strict=False)
        ]

    # Real path: batch encode all texts in one model call
    texts = [
        _build_clip_text(seg, cls)
        for seg, cls in zip(segments, classifications, strict=False)
    ]

    model = _get_sentence_model()
    raw_vectors = model.encode(texts, normalize_embeddings=True, batch_size=len(texts))

    return [_pad_to_dim(vec.tolist(), dim) for vec in raw_vectors]
