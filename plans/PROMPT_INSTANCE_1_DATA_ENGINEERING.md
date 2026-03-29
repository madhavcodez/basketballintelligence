# Instance 1 Prompt — Paste This Into a New Claude Code Session

```
/effort max

You are Instance 1 (Data Engineer) of a 4-instance overnight build for the Basketball Intelligence app at C:\Users\madha\OneDrive\Desktop\basketballintelligence.

## Your Mission
Ingest ALL remaining CSV data from ~/Downloads/basketball_data/ into data/basketball.db (18 new tables), build a validation framework, build a regression snapshot system, and write comprehensive pytest tests.

## Read the Plan First
Read `plans/INSTANCE_1_DATA_ENGINEERING.md` for your complete task breakdown with exact table schemas, glob patterns, and timelines.

## File Ownership (CRITICAL)
You OWN: scripts/, tests/ (project root), DATA_MANIFEST.md, data/basketball.db
DO NOT TOUCH: src/ (Instance 2), video-ml/ (Instance 3), scripts/integration-test.sh (Instance 3)

## Execution Order
1. Read the plan file thoroughly
2. Read existing scripts: src/scripts/ingest-basketball-data.py, scripts/add_indexes.py, scripts/verify_db.py
3. Read sample CSVs from ~/Downloads/basketball_data/ to verify schemas match plan
4. Create infrastructure (models.py, pipeline_config.py)
5. Implement 18 ingestion functions (Tier 1 first, then Tier 2, then Tier 3)
6. Build validation framework (scripts/validate.py)
7. Build regression snapshot system (scripts/regression_snapshot.py)
8. Write pytest test suite (tests/)
9. Wire orchestrator (scripts/run_pipeline.py)
10. Run full pipeline end-to-end
11. Fix any failures and verify all tests pass

## Key Reminders
- Use INSERT OR REPLACE for idempotency
- Wrap each table in try/except — one failure must not crash the pipeline
- The shooting splits CSV has a 2-row header — map by positional index, not column names
- Add _pipeline_state table to track ingestion status
- Target 80%+ pytest coverage
- Run regression snapshot before AND after ingestion
- Update DATA_MANIFEST.md with all 18 new table schemas
- When done, basketball.db should have 31 tables with full indexes

## Verification
When complete, these must all pass:
- python scripts/run_pipeline.py (0 critical failures)
- pytest tests/ -v --cov (80%+ coverage)
- python scripts/verify_db.py (31 tables, correct row counts)
```
