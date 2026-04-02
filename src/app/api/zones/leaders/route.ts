import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ZONE_LIST } from '@/lib/shot-constants';
import type { ZoneName } from '@/lib/shot-constants';
import { handleApiError } from '@/lib/api-error';
import { jsonWithCache } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

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

    const leaders = rows.map((row, index) => {
      const pRow = db.prepare('SELECT person_id FROM players WHERE Player = ?').get(row.player) as { person_id: string | number } | undefined;
      return {
        player: row.player,
        personId: pRow?.person_id ?? null,
        fgPct: row.fgPct,
        attempts: row.attempts,
        makes: row.makes,
        rank: index + 1,
      };
    });

    return jsonWithCache({
      zone: zoneParam,
      season,
      leaders,
    }, 120);
  } catch (e) { return handleApiError(e, 'zones-leaders'); }
}
