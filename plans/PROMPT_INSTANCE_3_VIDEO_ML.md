# Instance 3 Prompt — Paste This Into a New Claude Code Session

```
/effort max

You are Instance 3 (Video ML + Testing) of a 4-instance overnight build for the Basketball Intelligence app at C:\Users\madha\OneDrive\Desktop\basketballintelligence.

## Your Mission
Make the video-ML pipeline production-real (real YOLO detection, scoreboard OCR, sentence-transformer embeddings), build cross-database linking, write comprehensive pytest coverage (80%+), and expand integration tests to all 52+ API endpoints.

## Read the Plan First
Read `plans/INSTANCE_3_VIDEO_ML_TESTING.md` for your complete task breakdown.

## File Ownership (CRITICAL)
You OWN: video-ml/ (all Python ML pipeline files), scripts/integration-test.sh, scripts/regression-snapshot.py
DO NOT TOUCH: src/ (Instance 2), scripts/ingest*.py, scripts/add_indexes.py, scripts/verify_db.py (Instance 1)
You may READ data/basketball.db but do NOT write to it.

## Execution Order
1. Read the plan file thoroughly
2. Install dependencies: pip install sentence-transformers easyocr pytest-cov
3. Read existing pipeline files:
   - video-ml/pipeline/detect.py (current mock YOLO)
   - video-ml/pipeline/embed.py (current pseudo-random vectors)
   - video-ml/utils/scoreboard_ocr.py (current stub)
   - video-ml/config.py (PipelineConfig)
   - video-ml/models/schemas.py (data models)
   - video-ml/tests/ (existing 3 test files)
4. Phase 1: Wire real YOLO11n detection in detect.py
5. Phase 2: Implement scoreboard OCR with EasyOCR in scoreboard_ocr.py
6. Phase 3: Real sentence-transformer embeddings in embed.py
7. Phase 4: Create video-ml/pipeline/link.py for cross-database linking
8. Phase 5: Create video-ml/tests/conftest.py with shared fixtures
9. Phase 6: Create 6 new test files (test_ingest, test_detect, test_tag, test_embed, test_export, test_link)
10. Phase 7: Run full pipeline on real video (76ers_vs_knicks, smallest file)
11. Phase 8: Expand integration-test.sh to 52+ endpoints + create regression-snapshot.py

## Key Reminders
- yolo11n.pt exists at video-ml/yolo11n.pt — fix the model path resolution in detect.py
- CPU-only torch (no CUDA) — YOLO inference will be slow. Only process 1 video.
- EasyOCR model download is ~100MB. Falls back to mock if download fails.
- sentence-transformers all-MiniLM-L6-v2 produces 384D vectors. Pad to 512 (config.embedding_dim).
- GAME_ID format mismatch: basketball.db uses NBA API IDs, demo data uses "DEMO-xxxx". Linking returns 0 matches on demo (expected). Code must handle gracefully.
- All ML stages must have graceful fallbacks — if YOLO/OCR/SBERT fails, fall back to mock. Pipeline never crashes.
- Target 80%+ pytest coverage on video-ml/pipeline/ and video-ml/utils/
- Run tests from video-ml/ directory: cd video-ml && python -m pytest tests/ -v --cov

## Verification
When complete:
- pytest video-ml/tests/ -v --cov (80%+ coverage, all tests pass)
- python -m scripts.process_game on a real video (completes without error)
- bash scripts/integration-test.sh (52+ endpoints tested)
- python scripts/regression-snapshot.py --capture (snapshot created)
```
