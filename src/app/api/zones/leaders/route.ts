import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ZONE_LIST } from '@/lib/shot-constants';
import type { ZoneName } from '@/lib/shot-constants';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const DEFAULT_MIN_ATTEMPTS = 50;

interface LeaderRow {
  readonly player: string;
  readonly attempts: number;
  readonly makes: number;
  readonly fgPct: number;
}

function isValidZone(zone: string): zone is ZoneName {
  return (ZONE_LIST as readonly string[]).includes(zone);
}

function clampInt(value: string | null, defaultVal: number, max: number): number {
  if (!value) return defaultVal;
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return defaultVal;
  return Math.min(n, max);
}

export async function GET(request: NextRequest) {
  const zoneParam = request.nextUrl.searchParams.get('zone');
  const seasonParam = request.nextUrl.searchParams.get('season') || undefined;
  const limit = clampInt(request.nextUrl.searchParams.get('limit'), DEFAULT_LIMIT, MAX_LIMIT);
  const minAttempts = clampInt(request.nextUrl.searchParams.get('minAttempts'), DEFAULT_MIN_ATTEMPTS, 10000);

  if (!zoneParam) {
    return NextResponse.json({ error: 'zone query parameter is required' }, { status: 400 });
  }

  if (!isValidZone(zoneParam)) {
    return NextResponse.json(
      { error: `Invalid zone. Valid zones: ${ZONE_LIST.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    const db = getDb();

    let season = seasonParam;
    if (!season) {
      const row = db.prepare('SELECT MAX(season) as s FROM shots').get() as { s: string } | undefined;
      season = row?.s;
    }

    if (!season) {
      return NextResponse.json({ error: 'No season data available' }, { status: 404 });
    }

    const rows = db.prepare(`
      SELECT PLAYER_NAME as player,
             COUNT(*) as attempts,
             SUM(CAST(SHOT_MADE_FLAG AS INTEGER)) as makes,
             ROUND(CAST(SUM(CAST(SHOT_MADE_FLAG AS INTEGER)) AS FLOAT) / COUNT(*), 4) as fgPct
      FROM shots
      WHERE SHOT_ZONE_BASIC = ? AND season = ?
      GROUP BY PLAYER_NAME
      HAVING COUNT(*) >= ?
      ORDER BY fgPct DESC
      LIMIT ?
    `).all(zoneParam, season, minAttempts, limit) as LeaderRow[];

    const leaders = rows.map((row, index) => ({
      player: row.player,
      fgPct: row.fgPct,
      attempts: row.attempts,
      makes: row.makes,
      rank: index + 1,
    }));

    return NextResponse.json({
      zone: zoneParam,
      season,
      leaders,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
