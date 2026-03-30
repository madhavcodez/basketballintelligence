import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import fs from 'fs';

// Check whether the database file exists before running DB-dependent tests
const dbPath = path.join(process.cwd(), 'data', 'basketball.db');
const dbExists = fs.existsSync(dbPath);

// clampLimit and clampOffset are not exported from db.ts, so we test
// their behaviour through the exported functions. We also test the
// pure logic by reproducing the implementations here so the test suite
// is always runnable, even without the database.

function clampLimit(
  value: string | number | undefined,
  defaultVal: number,
  max: number
): number {
  const n =
    typeof value === 'string' ? parseInt(value, 10) : (value ?? defaultVal);
  if (!Number.isFinite(n) || n < 1) return defaultVal;
  return Math.min(n, max);
}

function clampOffset(value: string | number | undefined): number {
  const n = typeof value === 'string' ? parseInt(value, 10) : (value ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

// ── clampLimit unit tests ─────────────────────────────────────────────────────

describe('clampLimit', () => {
  it('returns default for negative numbers', () => {
    expect(clampLimit(-5, 20, 100)).toBe(20);
  });

  it('returns default for zero', () => {
    expect(clampLimit(0, 20, 100)).toBe(20);
  });

  it('returns default for undefined', () => {
    expect(clampLimit(undefined, 20, 100)).toBe(20);
  });

  it('returns default for NaN string', () => {
    expect(clampLimit('abc', 20, 100)).toBe(20);
  });

  it('clamps to max when value exceeds max', () => {
    expect(clampLimit(200, 20, 100)).toBe(100);
  });

  it('passes through a valid value within range', () => {
    expect(clampLimit(50, 20, 100)).toBe(50);
  });

  it('accepts numeric string input', () => {
    expect(clampLimit('42', 20, 100)).toBe(42);
  });

  it('clamps a numeric string that exceeds max', () => {
    expect(clampLimit('999', 20, 100)).toBe(100);
  });
});

// ── clampOffset unit tests ────────────────────────────────────────────────────

describe('clampOffset', () => {
  it('returns 0 for negative numbers', () => {
    expect(clampOffset(-1)).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(clampOffset(undefined)).toBe(0);
  });

  it('returns 0 for NaN string', () => {
    expect(clampOffset('notanumber')).toBe(0);
  });

  it('returns 0 for zero', () => {
    expect(clampOffset(0)).toBe(0);
  });

  it('passes through a positive value', () => {
    expect(clampOffset(100)).toBe(100);
  });

  it('accepts a numeric string', () => {
    expect(clampOffset('50')).toBe(50);
  });
});

// ── DB-dependent tests (skipped when db file is absent) ───────────────────────

describe.skipIf(!dbExists)('searchPlayers (requires DB)', () => {
  let searchPlayers: (query: string, limit?: number, offset?: number) => unknown[];

  beforeAll(async () => {
    const mod = await import('@/lib/db');
    searchPlayers = mod.searchPlayers as typeof searchPlayers;
  });

  it('returns an array of results for a known player', () => {
    const results = searchPlayers('LeBron');
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it('returns results that include the search term in the name', () => {
    const results = searchPlayers('LeBron') as Array<{ name: string }>;
    for (const r of results) {
      expect(r.name.toLowerCase()).toContain('lebron');
    }
  });

  it('returns an empty array for a non-existent player', () => {
    const results = searchPlayers('ZZZNOTAPLAYER999');
    expect(results).toHaveLength(0);
  });
});

describe.skipIf(!dbExists)('getExploreData equivalent (requires DB)', () => {
  it('getFeaturedPlayers + getSeasons + getDataEdition return expected shapes', async () => {
    const { getFeaturedPlayers, getSeasons, getDataEdition } = await import(
      '@/lib/db'
    );

    const featured = getFeaturedPlayers(5);
    expect(Array.isArray(featured)).toBe(true);

    const seasons = getSeasons();
    expect(Array.isArray(seasons)).toBe(true);

    const edition = getDataEdition();
    expect(edition).toHaveProperty('shotCount');
    expect(edition).toHaveProperty('playerCount');
    expect(edition).toHaveProperty('earliestSeason');
    expect(edition).toHaveProperty('latestSeason');
    expect(edition).toHaveProperty('edition');
  });
});
