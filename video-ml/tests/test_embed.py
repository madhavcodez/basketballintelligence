"""Tests for the clip embedding generation module."""
from __future__ import annotations
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import PipelineConfig
from models.schemas import ClassificationResult, ClipSegment
from pipeline.embed import (
    generate_clip_embedding,
    generate_batch_embeddings,
    _build_clip_text,
    _deterministic_random_vector,
    _fallback_embedding,
    _pad_to_dim,
)


class TestDeterministicRandomVector:
    def test_returns_correct_dim(self):
        vec = _deterministic_random_vector("test", 512)
        assert len(vec) == 512

    def test_is_unit_normalized(self):
        vec = _deterministic_random_vector("seed123", 256)
        magnitude = sum(v * v for v in vec) ** 0.5
        assert abs(magnitude - 1.0) < 0.01

    def test_deterministic(self):
        v1 = _deterministic_random_vector("same_seed", 512)
        v2 = _deterministic_random_vector("same_seed", 512)
        assert v1 == v2

    def test_different_seeds_differ(self):
        v1 = _deterministic_random_vector("seed_a", 512)
        v2 = _deterministic_random_vector("seed_b", 512)
        assert v1 != v2


class TestPadToDim:
    def test_pads_shorter_vector(self):
        vec = [1.0, 2.0, 3.0]
        padded = _pad_to_dim(vec, 5)
        assert len(padded) == 5
        assert padded[3:] == [0.0, 0.0]

    def test_truncates_longer_vector(self):
        vec = [1.0, 2.0, 3.0, 4.0, 5.0]
        trimmed = _pad_to_dim(vec, 3)
        assert len(trimmed) == 3

    def test_same_length_unchanged(self):
        vec = [1.0, 2.0, 3.0]
        result = _pad_to_dim(vec, 3)
        assert result == vec


class TestBuildClipText:
    def test_basic_format(self):
        seg = ClipSegment(start_time=0, end_time=10, confidence=0.5)
        cls = ClassificationResult(play_type="isolation", primary_action="drive", confidence=0.6)
        text = _build_clip_text(seg, cls)
        assert "isolation" in text
        assert "drive" in text
        assert "basketball clip" in text

    def test_includes_player(self):
        seg = ClipSegment(start_time=0, end_time=8, confidence=0.5)
        cls = ClassificationResult(
            play_type="post_up", primary_action="hook_shot",
            primary_player="LeBron James", confidence=0.7,
        )
        text = _build_clip_text(seg, cls)
        assert "LeBron James" in text

    def test_none_classification(self):
        seg = ClipSegment(start_time=0, end_time=5, confidence=0.5)
        text = _build_clip_text(seg, None)
        assert "basketball clip" in text


class TestGenerateClipEmbedding:
    def test_returns_correct_dim(self, sample_segment, sample_classification):
        config = PipelineConfig(embedding_dim=512)
        emb = generate_clip_embedding(sample_segment, sample_classification, config)
        assert len(emb) == 512

    def test_all_floats(self, sample_segment):
        emb = generate_clip_embedding(sample_segment)
        assert all(isinstance(v, float) for v in emb)


class TestGenerateBatchEmbeddings:
    def test_batch_count(self):
        segs = [ClipSegment(start_time=i, end_time=i+5, confidence=0.5) for i in range(3)]
        embs = generate_batch_embeddings(segs)
        assert len(embs) == 3

    def test_batch_dim(self):
        config = PipelineConfig(embedding_dim=512)
        segs = [ClipSegment(start_time=0, end_time=10, confidence=0.5)]
        embs = generate_batch_embeddings(segs, config=config)
        assert len(embs[0]) == 512

    def test_batch_with_classifications(self):
        segs = [
            ClipSegment(start_time=0, end_time=10, confidence=0.5),
            ClipSegment(start_time=10, end_time=20, confidence=0.6),
        ]
        clss = [
            ClassificationResult(play_type="isolation", primary_action="drive", confidence=0.7),
            ClassificationResult(play_type="transition", primary_action="layup", confidence=0.8),
        ]
        embs = generate_batch_embeddings(segs, clss)
        assert len(embs) == 2
        assert all(len(e) == 512 for e in embs)

    def test_batch_with_video_id(self):
        segs = [ClipSegment(start_time=0, end_time=5, confidence=0.5)]
        embs = generate_batch_embeddings(segs, video_id=42)
        assert len(embs) == 1

    def test_embedding_with_quarter(self):
        seg = ClipSegment(start_time=0, end_time=8, confidence=0.5, quarter=3)
        cls = ClassificationResult(play_type="spot_up", primary_action="catch_and_shoot", confidence=0.6)
        text = _build_clip_text(seg, cls)
        assert "quarter 3" in text

    def test_embedding_with_tags(self):
        seg = ClipSegment(start_time=0, end_time=8, confidence=0.5)
        cls = ClassificationResult(
            play_type="isolation", primary_action="drive",
            confidence=0.6, tags=["near_basket", "fast_movement"],
        )
        text = _build_clip_text(seg, cls)
        assert "near_basket" in text


class TestFallbackEmbedding:
    def test_returns_correct_dim(self):
        seg = ClipSegment(start_time=0, end_time=10, confidence=0.5)
        cls = ClassificationResult(play_type="isolation", primary_action="drive", confidence=0.7)
        vec = _fallback_embedding(seg, cls, 512, video_id=1)
        assert len(vec) == 512

    def test_none_classification(self):
        seg = ClipSegment(start_time=0, end_time=5, confidence=0.5)
        vec = _fallback_embedding(seg, None, 256, video_id=None)
        assert len(vec) == 256

    def test_deterministic(self):
        seg = ClipSegment(start_time=0, end_time=10, confidence=0.5)
        v1 = _fallback_embedding(seg, None, 512, video_id=1)
        v2 = _fallback_embedding(seg, None, 512, video_id=1)
        assert v1 == v2

    @patch("pipeline.embed.SENTENCE_TRANSFORMERS_AVAILABLE", False)
    def test_single_embedding_uses_fallback(self):
        seg = ClipSegment(start_time=0, end_time=10, confidence=0.5)
        emb = generate_clip_embedding(seg)
        assert len(emb) == 512

    @patch("pipeline.embed.SENTENCE_TRANSFORMERS_AVAILABLE", False)
    def test_batch_uses_fallback(self):
        segs = [ClipSegment(start_time=i, end_time=i + 5, confidence=0.5) for i in range(3)]
        embs = generate_batch_embeddings(segs)
        assert len(embs) == 3
        assert all(len(e) == 512 for e in embs)
