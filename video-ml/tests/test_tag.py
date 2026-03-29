"""Tests for the auto-tagging engine."""
from __future__ import annotations
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from models.schemas import ClassificationResult, ClipSegment, DetectionResult, DetectedObject
from pipeline.tag import Tag, generate_tags


class TestGenerateTags:
    def test_returns_list_of_tags(self, sample_classification, sample_segment, sample_detections):
        tags = generate_tags(sample_classification, sample_segment, sample_detections)
        assert isinstance(tags, list)
        assert all(isinstance(t, Tag) for t in tags)

    def test_includes_play_type_tag(self):
        cls = ClassificationResult(play_type="pick_and_roll", primary_action="drive", confidence=0.7)
        seg = ClipSegment(start_time=0, end_time=10, confidence=0.5)
        tags = generate_tags(cls, seg)
        names = [t.name for t in tags]
        assert "pick and roll" in names

    def test_includes_action_tag(self):
        cls = ClassificationResult(play_type="isolation", primary_action="fadeaway", confidence=0.6)
        seg = ClipSegment(start_time=0, end_time=8, confidence=0.5)
        tags = generate_tags(cls, seg)
        names = [t.name for t in tags]
        assert "fadeaway" in names

    def test_includes_team_tags(self):
        cls = ClassificationResult(play_type="transition", confidence=0.5)
        seg = ClipSegment(start_time=0, end_time=10, confidence=0.5)
        tags = generate_tags(cls, seg, home_team="Lakers", away_team="Celtics")
        names = [t.name for t in tags]
        assert "Lakers" in names
        assert "Celtics" in names

    def test_quarter_context_tag(self):
        cls = ClassificationResult(play_type="spot_up", confidence=0.5)
        seg = ClipSegment(start_time=0, end_time=8, confidence=0.5, quarter=3)
        tags = generate_tags(cls, seg)
        names = [t.name for t in tags]
        assert "Q3" in names

    def test_long_possession_tag(self):
        cls = ClassificationResult(play_type="post_up", confidence=0.5)
        seg = ClipSegment(start_time=0, end_time=20, confidence=0.5)
        tags = generate_tags(cls, seg)
        names = [t.name for t in tags]
        assert "long possession" in names

    def test_quality_tags_from_detections(self, sample_detections):
        cls = ClassificationResult(play_type="isolation", confidence=0.5)
        seg = ClipSegment(start_time=0, end_time=10, confidence=0.5)
        tags = generate_tags(cls, seg, sample_detections)
        names = [t.name for t in tags]
        assert "clear court view" in names

    def test_no_miscellaneous_play_type_tag(self):
        cls = ClassificationResult(play_type="miscellaneous", primary_action="rebound", confidence=0.3)
        seg = ClipSegment(start_time=0, end_time=8, confidence=0.5)
        tags = generate_tags(cls, seg)
        names = [t.name for t in tags]
        assert "miscellaneous" not in names
