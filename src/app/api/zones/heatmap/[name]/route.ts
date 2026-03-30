import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { classifyZone } from '@/lib/zone-engine';
import { handleApiError } from '@/lib/api-error';
import { jsonWithCache } from '@/lib/api-response';

const DEFAULT_LIMIT = 5000;
const MAX_LIMIT = 10000;

interface ShotRow {
  readonly x: number;
  readonly y: number;
  readonly made: number;
}

function clampLimit(value: string | null, defaultVal: number, max: number): number {
  if (!value) return defaultVal;
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return defaultVal;
  return Math.min(n, max);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const playerName = decodeURIComponent(name);
  const season = request.nextUrl.searchParams.get('season') || undefined;
  const limit = clampLimit(request.nextUrl.searchParams.get('limit'), DEFAULT_LIMIT, MAX_LIMIT);

  try {
    const db = getDb();

    const countParts = ['SELECT COUNT(*) as total FROM shots WHERE PLAYER_NAME = ?'];
    const shotParts = ['SELECT CAST(LOC_X AS REAL) * 10 as x, (CAST(LOC_Y AS REAL) - 5.25) * 10 as y, SHOT_MADE_FLAG as made FROM shots WHERE PLAYER_NAME = ?'];
    const countParams: (string | number)[] = [playerName];
    const shotParams: (string | number)[] = [playerName];

    if (season) {
      countParts.push('AND season = ?');
      shotParts.push('AND season = ?');
      countParams.push(season);
      shotParams.push(season);
    }

    shotParts.push('LIMIT ?');
    shotParams.push(limit);

    const countRow = db.prepare(countParts.join(' ')).get(...countParams) as { total: number } | undefined;
    const totalShots = countRow?.total ?? 0;

    if (totalShots === 0) {
      return NextResponse.json({ error: 'No shots found for this player' }, { status: 404 });
    }

    const rows = db.prepare(shotParts.join(' ')).all(...shotParams) as ShotRow[];

    const shots = rows.map((row) => ({
      x: row.x,
      y: row.y,
      made: row.made,
      zone: classifyZone(row.x, row.y),
    }));

    return jsonWithCache({
      player: playerName,
      season: season ?? 'all',
      shots,
      totalShots,
    }, 120);
  } catch (e) { return handleApiError(e, 'zones-heatmap'); }
}
