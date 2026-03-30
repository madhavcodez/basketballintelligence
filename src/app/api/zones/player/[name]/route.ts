import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { aggregateByZone, classifyShotSignature } from '@/lib/zone-engine';
import type { ShotInput, ZoneAggregation } from '@/lib/zone-engine';
import { handleApiError } from '@/lib/api-error';
import { jsonWithCache } from '@/lib/api-response';

const MIN_ATTEMPTS_FOR_EXTREMES = 10;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const playerName = decodeURIComponent(name);
  const season = request.nextUrl.searchParams.get('season') || undefined;

  try {
    const db = getDb();

    const sqlParts = ['SELECT CAST(LOC_X AS REAL) * 10 as x, (CAST(LOC_Y AS REAL) - 5.25) * 10 as y, SHOT_MADE_FLAG as made, SHOT_DISTANCE as distance FROM shots WHERE PLAYER_NAME = ?'];
    const sqlParams: (string | number)[] = [playerName];

    if (season) {
      sqlParts.push('AND season = ?');
      sqlParams.push(season);
    }

    const shots = db.prepare(sqlParts.join(' ')).all(...sqlParams) as ShotInput[];

    if (shots.length === 0) {
      return NextResponse.json({ error: 'No shots found for this player' }, { status: 404 });
    }

    const zones = aggregateByZone(shots);
    const shotSignature = classifyShotSignature(zones, shots.length);

    const qualifiedZones = zones.filter((z) => z.attempts >= MIN_ATTEMPTS_FOR_EXTREMES);

    const topZone = qualifiedZones.length > 0
      ? qualifiedZones.reduce<ZoneAggregation>((best, z) => z.fgPct > best.fgPct ? z : best, qualifiedZones[0])
      : null;

    const coldestZone = qualifiedZones.length > 0
      ? qualifiedZones.reduce<ZoneAggregation>((worst, z) => z.fgPct < worst.fgPct ? z : worst, qualifiedZones[0])
      : null;

    // Look up person_id for headshot
    const playerRow = db.prepare('SELECT person_id FROM players WHERE Player = ?').get(playerName) as { person_id: string | number } | undefined;

    return jsonWithCache({
      player: playerName,
      personId: playerRow?.person_id ?? null,
      season: season ?? 'all',
      totalShots: shots.length,
      zones,
      topZone: topZone ? { zone: topZone.zone, fgPct: topZone.fgPct } : null,
      coldestZone: coldestZone ? { zone: coldestZone.zone, fgPct: coldestZone.fgPct } : null,
      shotSignature,
    }, 120);
  } catch (e) { return handleApiError(e, 'zones-player'); }
}
