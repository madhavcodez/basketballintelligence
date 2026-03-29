# Instance 3: Video ML Production & Cross-Instance Testing

**Duration:** 6 hours | **Owner:** All files under `video-ml/`, `scripts/integration-test.sh`, `scripts/regression-snapshot.py`

## DO NOT TOUCH
- `src/` directory (owned by Instance 2)
- `scripts/ingest*.py`, `scripts/add_indexes.py`, `scripts/verify_db.py` (owned by Instance 1)
- `data/basketball.db` writes (owned by Instance 1; you may READ it)

---

## Mission

Make the video-ML pipeline production-real by wiring up actual YOLO detection, scoreboard OCR, and sentence-transformer embeddings. Build comprehensive pytest coverage (80%+). Expand integration tests to cover all 52+ API endpoints. Create a regression snapshot system.

## Pre-installed Dependencies (confirmed)
- ultralytics 8.4.31 (YOLO)
- torch 2.11.0+cpu
- opencv-python 4.11.0.86
- pydantic 2.8.2
- pytest 8.3.3
- yolo11n.pt model at `video-ml/yolo11n.pt`

## Phase 0: Environment Setup (0:00 - 0:15)

```bash
pip install sentence-transformers easyocr pytest-cov
python -c "from ultralytics import YOLO; from sentence_transformers import SentenceTransformer; import easyocr; print('OK')"
```

---

## Phase 1: Real YOLO Detection (0:15 - 1:00)

**File:** `video-ml/pipeline/detect.py`

### Changes:
1. **Fix model path** — `_get_yolo_model()` should resolve relative to video-ml/ root:
```python
model_path = Path(__file__).resolve().parent.parent / model_name
```

2. **Make real YOLO the primary path** — Restructure `detect_objects_in_clip`:
```python
# PRIMARY: Real YOLO detection
if YOLO_AVAILABLE and CV2_AVAILABLE and video_path.exists():
    try:
        results = _real_detection(str(video_path), segment, config)
        if results:
            return results
    except Exception:
        logger.exception("YOLO detection failed, falling back to mock")

# FALLBACK: Mock detection
```

3. **Add hoop estimation** — After YOLO detection, estimate hoop position using court geometry:
```python
# Hoop is typically in top 15% of frame, horizontally centered
if objects and any(o.label == "player" for o in objects):
    objects.append(DetectedObject(label="hoop", confidence=0.7, bbox=(0.42, 0.02, 0.58, 0.12)))
```

4. **Test** — Run against smallest video:
```bash
python -c "
from pathlib import Path
from pipeline.detect import detect_objects_in_clip
from models.schemas import ClipSegment
seg = ClipSegment(start_time=5.0, end_time=15.0, confidence=0.8)
results = detect_objects_in_clip(Path('../data/76ers_vs_knicks_jan_22_2025.mp4'), seg)
print(f'{len(results)} frames, {sum(len(r.objects) for r in results)} objects')
"
```

---

## Phase 2: Scoreboard OCR (1:00 - 1:45)

**File:** `video-ml/utils/scoreboard_ocr.py` (currently a stub with TODO comments)

### Implementation:

1. **EasyOCR reader** (lazy init, GPU=False):
```python
try:
    import easyocr
    EASYOCR_AVAILABLE = True
    _reader_cache = {}
except ImportError:
    EASYOCR_AVAILABLE = False
```

2. **Scoreboard region detection** — Crop top 15% of frame (NBA broadcast standard)

3. **Parse helpers:**
```python
def _parse_clock(text: str) -> str | None:
    """Extract M:SS or MM:SS from OCR text."""
    match = re.search(r'\b(\d{1,2}:\d{2})\b', text)
    return match.group(1) if match else None

def _parse_scores(text: str) -> list[int]:
    """Extract plausible basketball scores (0-200) from OCR text."""
    numbers = re.findall(r'\b(\d{2,3})\b', text)
    return [int(n) for n in numbers if 0 <= int(n) <= 200][:2]

def _parse_quarter(text: str) -> int | None:
    """Extract quarter (1-4, 5=OT) from OCR text."""
    # Match: 1st, 2nd, 3rd, 4th, Q1-Q4, OT
```

4. **Main function** — `extract_scoreboard(frame)`:
   - Crop scoreboard region
   - Run EasyOCR reader
   - Parse clock, scores, quarter
   - Return ScoreboardReading with confidence
   - Fall back to mock if confidence < 0.1

---

## Phase 3: Real Sentence-Transformer Embeddings (1:45 - 2:15)

**File:** `video-ml/pipeline/embed.py`

### Changes:

1. **Import with fallback:**
```python
try:
    from sentence_transformers import SentenceTransformer
    SBERT_AVAILABLE = True
except ImportError:
    SBERT_AVAILABLE = False
```

2. **Model:** `all-MiniLM-L6-v2` (384D output). Pad to config.embedding_dim (512) with zeros.

3. **Build clip text description** from classification metadata:
```python
def _build_clip_description(segment, classification):
    parts = []
    if classification:
        if classification.play_type: parts.append(classification.play_type.replace("_", " "))
        if classification.primary_action: parts.append(classification.primary_action.replace("_", " "))
        if classification.primary_player: parts.append(classification.primary_player)
        parts.extend(t.replace("_", " ") for t in classification.tags)
    if segment.quarter: parts.append(f"quarter {segment.quarter}")
    return " ".join(parts) if parts else "basketball clip"
```

4. **Batch encoding** support in `generate_batch_embeddings`:
```python
model = _get_sbert_model()
descriptions = [_build_clip_description(seg, cls) for seg, cls in zip(segments, classifications)]
embeddings = model.encode(descriptions, normalize_embeddings=True, batch_size=config.batch_size)
```

---

## Phase 4: Cross-Database Linking (2:15 - 3:15)

**New file:** `video-ml/pipeline/link.py`

### Purpose
Link video clips in film.db to basketball.db data:
- Match clips to `shots` table by GAME_ID + PERIOD + game clock (+-30s tolerance)
- Match clips to `player_game_logs` by GAME_ID + PLAYER_NAME

### Functions:
```python
def link_clip_to_shot(film_db_path, basketball_db_path, clip_id, game_id, quarter, game_clock, player_name, *, time_tolerance_seconds=30) -> str | None

def link_clip_to_player_game_log(film_db_path, basketball_db_path, clip_id, game_id, player_name) -> str | None

def link_all_clips(config: PipelineConfig) -> dict[str, int]  # returns {shots_linked, game_logs_linked, total_clips}
```

### Integration
Add as final step in `scripts/process_game.py` after export:
```python
from pipeline.link import link_all_clips
link_stats = link_all_clips(config)
```

### Note on GAME_ID format
- basketball.db uses NBA API game IDs (integers like `21600001`)
- film.db demo data uses `"DEMO-0042"`
- Linking will return 0 matches on demo data (expected). Works when real game IDs are used.

---

## Phase 5: Test Infrastructure (3:15 - 3:45)

**New file:** `video-ml/tests/conftest.py`

### Shared Fixtures:
- `config(tmp_path)` — PipelineConfig pointing to temp directories
- `film_db(config)` — Initialized empty film.db
- `sample_segment()` — ClipSegment(start_time=10.0, end_time=20.0, confidence=0.8, quarter=2, game_clock="8:42")
- `sample_detection()` — DetectionResult with 4 objects (2 players, 1 ball, 1 hoop)
- `sample_detections()` — 10 frames of detection results
- `sample_classification()` — ClassificationResult(play_type="pick_and_roll", action="drive", player="LeBron James")
- `sample_metadata()` — VideoMetadata for test video
- `sample_video_path()` — Returns first available real video or fake path

---

## Phase 6: New Test Files (3:45 - 5:15)

### `tests/test_ingest.py` (video ingest, not CSV ingest)
- TestExtractMetadata: real video (if available), nonexistent path, field validation
- TestCreateVideoRecord: insert returns valid ID, record retrievable
- TestIngestVideo: end-to-end returns (video_id, metadata)

### `tests/test_detect.py`
- TestMockDetection: returns DetectionResult, deterministic, labels correct, bbox in [0,1]
- TestDetectObjectsInClip: nonexistent video -> mock fallback, frame count correct
- TestRealDetection (skipif not YOLO_AVAILABLE): real video produces detections

### `tests/test_tag.py`
- TestGenerateTags: action tags from play_type, player tags, team tags, context tags, dedup
- TestTag: dataclass is frozen, valid categories

### `tests/test_embed.py`
- TestDeterministicVector: correct dim, L2 norm = 1.0, deterministic
- TestGenerateClipEmbedding: returns list[float], correct dim, non-zero
- TestBatchEmbeddings: correct count, each correct dim
- TestRealEmbedding (skipif not SBERT): meaningful vectors, similar > dissimilar

### `tests/test_export.py`
- TestInitFilmDb: creates tables, idempotent, all expected tables exist
- TestInsertClip: returns valid ID, clip retrievable
- TestInsertClipTags: returns tag count, get_or_create idempotent
- TestCreateProcessingJob: returns ID, status is "running"
- TestExportToJson: JSON created, contains video + clips

### `tests/test_link.py`
- TestParseClockToRemaining: various formats
- TestLinkClipToShot: with mock basketball.db
- TestLinkClipToPlayerGameLog: with mock basketball.db
- TestLinkAllClips: empty film.db, no game_id clips

**Target:** 40+ test functions, 80%+ coverage.

---

## Phase 7: Full Pipeline Run (5:15 - 5:45)

Process one real video through the complete upgraded pipeline:
```bash
cd video-ml
python -m scripts.process_game \
  --input "../data/76ers_vs_knicks_jan_22_2025.mp4" \
  --db "../data/film.db" \
  --game-id "NBA-TEST-001" \
  --game-date "2025-01-22" \
  --home-team "76ers" \
  --away-team "Knicks" \
  --season "2024-25" \
  --export-json
```

Verify:
- New clips in film.db with real classification data
- Embeddings are real (not random)
- Processing completes without errors
- JSON export file exists

---

## Phase 8: Integration Tests + Regression (5:45 - 6:00)

### Expand `scripts/integration-test.sh`
From 10 endpoints to 52+. Add all categories:
- V2 API (explore, players, teams, standings, shot-lab, quiz, lineups, data-status)
- Film API (clips, tags, players, upload/process 405 check)
- Zone API (player, heatmap, compare, league, similar, trend, leaders, spotlight)
- Matchup API (games, rivals)
- Timeline API
- Agentic API (405 on GET)

### Create `scripts/regression-snapshot.py`
Capture/compare system for film.db + basketball.db:
- Table counts, row counts, schema validation
- Key query results (video count, clip count, linked shots)
- Before/after comparison with pass/fail reporting

### Run:
```bash
python scripts/regression-snapshot.py --capture
pytest video-ml/tests/ -v --cov=pipeline --cov=utils --cov=models --cov-report=term-missing
bash scripts/integration-test.sh
python scripts/regression-snapshot.py --compare
```

---

## Key New Files

| File | Purpose |
|------|---------|
| `video-ml/pipeline/link.py` | Cross-database linking (film.db -> basketball.db) |
| `video-ml/tests/conftest.py` | Shared pytest fixtures |
| `video-ml/tests/test_ingest.py` | Video ingest tests |
| `video-ml/tests/test_detect.py` | Object detection tests |
| `video-ml/tests/test_tag.py` | Auto-tagging tests |
| `video-ml/tests/test_embed.py` | Embedding tests |
| `video-ml/tests/test_export.py` | Export/DB tests |
| `video-ml/tests/test_link.py` | Cross-DB linking tests |
| `scripts/regression-snapshot.py` | Regression detection system |

## Key Modified Files

| File | Changes |
|------|---------|
| `video-ml/pipeline/detect.py` | Real YOLO primary, model path fix, hoop estimation |
| `video-ml/pipeline/embed.py` | Real sentence-transformers, batch encoding |
| `video-ml/utils/scoreboard_ocr.py` | EasyOCR implementation, parse helpers |
| `video-ml/scripts/process_game.py` | Add link step after export |
| `scripts/integration-test.sh` | Expand to 52+ endpoints |

## Risk Mitigations
- CPU-only YOLO is slow (~10 min per video). Only process 1 video.
- EasyOCR model download (~100MB) may be slow. Pipeline falls back to mock if it fails.
- sentence-transformers model download (~90MB). Falls back to pseudo-random if it fails.
- All fallbacks preserve pipeline integrity — nothing breaks if a dependency fails.
