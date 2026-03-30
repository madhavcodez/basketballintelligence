import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';

const DB_EXISTS = existsSync(path.join(process.cwd(), 'data', 'basketball.db'));

// ── Players search route ──────────────────────────────────────────────────────

describe('GET /api/players/search', () => {
  it('returns empty array when query is shorter than 2 chars', async () => {
    const { GET } = await import('@/app/api/players/search/route');
    const req = new NextRequest('http://localhost/api/players/search?q=L');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0);
  });

  it('returns empty array when no query param provided', async () => {
    const { GET } = await import('@/app/api/players/search/route');
    const req = new NextRequest('http://localhost/api/players/search');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0);
  });
});

describe.skipIf(!DB_EXISTS)('GET /api/players/search (requires DB)', () => {
  it('returns player results for a valid query', async () => {
    const { GET } = await import('@/app/api/players/search/route');
    const req = new NextRequest('http://localhost/api/players/search?q=LeBron');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    const first = body[0] as { name: string };
    expect(first.name.toLowerCase()).toContain('lebron');
  });

  it('respects limit param', async () => {
    const { GET } = await import('@/app/api/players/search/route');
    const req = new NextRequest(
      'http://localhost/api/players/search?q=James&limit=2',
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeLessThanOrEqual(2);
  });
});

// ── Explore route ─────────────────────────────────────────────────────────────

describe.skipIf(!DB_EXISTS)('GET /api/explore (requires DB)', () => {
  it('returns expected data shape', async () => {
    const { GET } = await import('@/app/api/explore/route');
    const req = new NextRequest('http://localhost/api/explore');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(Array.isArray(body.featured)).toBe(true);
    expect(Array.isArray(body.topScorers)).toBe(true);
    expect(Array.isArray(body.seasons)).toBe(true);
    expect(body.edition).toBeDefined();
    expect(Array.isArray(body.allTimeScorers)).toBe(true);
  });

  it('returns seasonType field', async () => {
    const { GET } = await import('@/app/api/explore/route');
    const req = new NextRequest('http://localhost/api/explore?seasonType=regular');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.seasonType).toBeDefined();
  });
});
