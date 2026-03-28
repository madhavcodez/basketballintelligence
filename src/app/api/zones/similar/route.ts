import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { aggregateByZone, classifyShotSignature } from '@/lib/zone-engine';
import type { ShotInput, ZoneAggregation } from '@/lib/zone-engine';

// Find players with similar zone profiles based on cosine similarity of attempt distributions
export async function GET(request: NextRequest) {
  const playerName = request.nextUrl.searchParams.get('player');
  const seasonParam = request.nextUrl.searchParams.get('season') || undefined;
  const limitParam = request.nextUrl.searchParams.get('limit') || '5';

  if (!playerName) {
    return NextResponse.json({ error: 'player parameter is required' }, { status: 400 });
  }

  const limit = Math.min(parseInt(limitParam, 10) || 5, 20);

  try {
    const db = getDb();

    let season = seasonParam;
    if (!season) {
      const row = db.prepare('SELECT MAX(season) as s FROM shots').get() as { s: string } | undefined;
      season = row?.s;
    }
    if (!season) {
      return NextResponse.json({ error: 'No season data' }, { status: 404 });
    }

    // Get target player's zone distribution
    const targetShots = db.prepare(
      'SELECT CAST(LOC_X AS REAL) * 10 as x, (CAST(LOC_Y AS REAL) - 5.25) * 10 as y, SHOT_MADE_FLAG as made, SHOT_DISTANCE as distance FROM shots WHERE PLAYER_NAME = ? AND season = ?'
    ).all(playerName, season) as ShotInput[];

    if (targetShots.length < 50) {
      return NextResponse.json({ error: 'Not enough shots for comparison' }, { status: 404 });
    }

    const targetZones = aggregateByZone(targetShots);
    const targetVec = zoneToVector(targetZones);

    // Get all players with at least 200 shots in this season
    const players = db.prepare(
      `SELECT PLAYER_NAME as name, COUNT(*) as cnt
       FROM shots WHERE season = ?
       GROUP BY PLAYER_NAME
       HAVING cnt >= 200 AND PLAYER_NAME != ?
       ORDER BY cnt DESC
       LIMIT 200`
    ).all(season, playerName) as Array<{ name: string; cnt: number }>;

    // Compute similarity for each candidate
    const similarities: Array<{
      player: string;
      similarity: number;
      signature: string;
      totalShots: number;
      topZone: string;
      topZoneFgPct: number;
    }> = [];

    for (const p of players) {
      const shots = db.prepare(
        'SELECT CAST(LOC_X AS REAL) * 10 as x, (CAST(LOC_Y AS REAL) - 5.25) * 10 as y, SHOT_MADE_FLAG as made, SHOT_DISTANCE as distance FROM shots WHERE PLAYER_NAME = ? AND season = ?'
      ).all(p.name, season) as ShotInput[];

      const zones = aggregateByZone(shots);
      const vec = zoneToVector(zones);
      const sim = cosineSimilarity(targetVec, vec);

      const sig = classifyShotSignature(zones, shots.length);
      const topZ = [...zones].sort((a, b) => b.fgPct - a.fgPct).find((z) => z.attempts >= 10);

      similarities.push({
        player: p.name,
        similarity: sim,
        signature: sig,
        totalShots: shots.length,
        topZone: topZ?.zone ?? 'N/A',
        topZoneFgPct: topZ?.fgPct ?? 0,
      });
    }

    similarities.sort((a, b) => b.similarity - a.similarity);

    return NextResponse.json({
      player: playerName,
      season,
      similar: similarities.slice(0, limit),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Convert zone aggregations to a vector of attempt percentages
function zoneToVector(zones: readonly ZoneAggregation[]): number[] {
  const zoneOrder = [
    'Restricted Area',
    'In The Paint (Non-RA)',
    'Mid-Range',
    'Left Corner 3',
    'Right Corner 3',
    'Above the Break 3',
  ];
  return zoneOrder.map((name) => {
    const z = zones.find((zz) => zz.zone === name);
    return z?.attPct ?? 0;
  });
}

// Cosine similarity between two vectors
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom > 0 ? dot / denom : 0;
}
