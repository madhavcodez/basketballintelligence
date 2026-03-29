import { NextRequest, NextResponse } from 'next/server';
import { getPlayerShotSeasons } from '@/lib/db';
import { parseSeasonType, getPlayerShotsV2, getShotZoneStatsV2 } from '@/lib/playoffs-db';

export async function GET(request: NextRequest) {
  const player = request.nextUrl.searchParams.get('player');
  const season = request.nextUrl.searchParams.get('season') || undefined;
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '5000', 10);
  const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0', 10);
  const seasonType = parseSeasonType(request.nextUrl.searchParams.get('seasonType'));
  if (!player) return NextResponse.json({ error: 'Player required' }, { status: 400 });
  try {
    const shotsResult = getPlayerShotsV2(player, seasonType, season, limit, offset);
    const zonesResult = getShotZoneStatsV2(player, seasonType, season);
    const seasons = getPlayerShotSeasons(player);
    return NextResponse.json({
      shots: shotsResult.data,
      zones: zonesResult.data,
      seasons,
      seasonType: shotsResult.seasonType,
      playoffAvailable: shotsResult.playoffAvailable,
    });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
