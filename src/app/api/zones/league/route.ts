import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { aggregateByZone } from '@/lib/zone-engine';
import type { ShotInput } from '@/lib/zone-engine';
import { handleApiError } from '@/lib/api-error';
import { jsonWithCache } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const seasonParam = request.nextUrl.searchParams.get('season') || undefined;

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

    const shots = db.prepare(
      'SELECT CAST(LOC_X AS REAL) * 10 as x, (CAST(LOC_Y AS REAL) - 5.25) * 10 as y, SHOT_MADE_FLAG as made, SHOT_DISTANCE as distance FROM shots WHERE season = ?'
    ).all(season) as ShotInput[];

    if (shots.length === 0) {
      return NextResponse.json({ error: 'No shots found for this season' }, { status: 404 });
    }

    const zones = aggregateByZone(shots);

    const totalMakes = shots.reduce((sum, s) => sum + s.made, 0);
    const leagueAvgFgPct = totalMakes / shots.length;

    return jsonWithCache({
      season,
      zones,
      leagueAvgFgPct,
    }, 120);
  } catch (e) { return handleApiError(e, 'zones-league'); }
}
