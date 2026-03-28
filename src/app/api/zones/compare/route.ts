import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { aggregateByZone, classifyShotSignature } from '@/lib/zone-engine';
import type { ShotInput, ZoneAggregation } from '@/lib/zone-engine';

interface ComparisonEntry {
  readonly zone: string;
  readonly player1FgPct: number;
  readonly player2FgPct: number;
  readonly leagueFgPct: number;
  readonly winner: 'p1' | 'p2' | 'tie';
}

function queryPlayerShots(db: ReturnType<typeof getDb>, playerName: string, season?: string): ShotInput[] {
  const sqlParts = ['SELECT CAST(LOC_X AS REAL) * 10 as x, (CAST(LOC_Y AS REAL) - 5.25) * 10 as y, SHOT_MADE_FLAG as made, SHOT_DISTANCE as distance FROM shots WHERE PLAYER_NAME = ?'];
  const sqlParams: (string | number)[] = [playerName];

  if (season) {
    sqlParts.push('AND season = ?');
    sqlParams.push(season);
  }

  return db.prepare(sqlParts.join(' ')).all(...sqlParams) as ShotInput[];
}

function queryLeagueShots(db: ReturnType<typeof getDb>, season: string): ShotInput[] {
  return db.prepare(
    'SELECT CAST(LOC_X AS REAL) * 10 as x, (CAST(LOC_Y AS REAL) - 5.25) * 10 as y, SHOT_MADE_FLAG as made, SHOT_DISTANCE as distance FROM shots WHERE season = ?'
  ).all(season) as ShotInput[];
}

function buildComparison(
  p1Zones: readonly ZoneAggregation[],
  p2Zones: readonly ZoneAggregation[],
  leagueZones: readonly ZoneAggregation[]
): ComparisonEntry[] {
  const p1Map = new Map(p1Zones.map((z) => [z.zone, z]));
  const p2Map = new Map(p2Zones.map((z) => [z.zone, z]));
  const leagueMap = new Map(leagueZones.map((z) => [z.zone, z]));

  const allZoneNames = new Set([
    ...p1Zones.map((z) => z.zone),
    ...p2Zones.map((z) => z.zone),
    ...leagueZones.map((z) => z.zone),
  ]);

  return Array.from(allZoneNames).map((zone): ComparisonEntry => {
    const p1FgPct = p1Map.get(zone)?.fgPct ?? 0;
    const p2FgPct = p2Map.get(zone)?.fgPct ?? 0;
    const lgFgPct = leagueMap.get(zone)?.fgPct ?? 0;

    let winner: 'p1' | 'p2' | 'tie' = 'tie';
    if (p1FgPct > p2FgPct) winner = 'p1';
    else if (p2FgPct > p1FgPct) winner = 'p2';

    return {
      zone,
      player1FgPct: p1FgPct,
      player2FgPct: p2FgPct,
      leagueFgPct: lgFgPct,
      winner,
    };
  });
}

export async function GET(request: NextRequest) {
  const p1Name = request.nextUrl.searchParams.get('p1');
  const p2Name = request.nextUrl.searchParams.get('p2');
  const seasonParam = request.nextUrl.searchParams.get('season') || undefined;

  if (!p1Name || !p2Name) {
    return NextResponse.json({ error: 'Both p1 and p2 query parameters are required' }, { status: 400 });
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

    const p1Shots = queryPlayerShots(db, p1Name, season);
    const p2Shots = queryPlayerShots(db, p2Name, season);
    const leagueShots = queryLeagueShots(db, season);

    if (p1Shots.length === 0) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }
    if (p2Shots.length === 0) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const p1Zones = aggregateByZone(p1Shots);
    const p2Zones = aggregateByZone(p2Shots);
    const leagueZones = aggregateByZone(leagueShots);

    const p1Signature = classifyShotSignature(p1Zones, p1Shots.length);
    const p2Signature = classifyShotSignature(p2Zones, p2Shots.length);

    const comparison = buildComparison(p1Zones, p2Zones, leagueZones);

    return NextResponse.json({
      player1: { name: p1Name, zones: p1Zones, signature: p1Signature },
      player2: { name: p2Name, zones: p2Zones, signature: p2Signature },
      league: { zones: leagueZones },
      comparison,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
