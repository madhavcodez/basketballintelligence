import { NextRequest, NextResponse } from 'next/server';
import { parseSeasonType, comparePlayersV2, getShotZoneStatsV2 } from '@/lib/playoffs-db';
import { handleApiError } from '@/lib/api-error';
import { jsonWithCache } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const p1 = request.nextUrl.searchParams.get('p1');
  const p2 = request.nextUrl.searchParams.get('p2');
  const season = request.nextUrl.searchParams.get('season') || undefined;
  const seasonType = parseSeasonType(request.nextUrl.searchParams.get('seasonType'));
  if (!p1 || !p2) return NextResponse.json({ error: 'Two players required' }, { status: 400 });
  try {
    const comparison = comparePlayersV2(p1, p2, seasonType, season);
    const zones1Result = getShotZoneStatsV2(p1, seasonType, season);
    const zones2Result = getShotZoneStatsV2(p2, seasonType, season);
    return jsonWithCache({
      player1: comparison.player1,
      player2: comparison.player2,
      zones1: zones1Result.data,
      zones2: zones2Result.data,
      seasonType: comparison.seasonType,
      playoffAvailable: comparison.playoffAvailable,
    }, 120);
  } catch (e) { return handleApiError(e, 'compare'); }
}
