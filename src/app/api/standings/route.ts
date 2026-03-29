import { NextRequest, NextResponse } from 'next/server';
import { getSeasons } from '@/lib/db';
import { parseSeasonType, getStandingsV2 } from '@/lib/playoffs-db';

export async function GET(request: NextRequest) {
  const season = request.nextUrl.searchParams.get('season') || undefined;
  const seasonType = parseSeasonType(request.nextUrl.searchParams.get('seasonType'));
  try {
    const standingsResult = getStandingsV2(seasonType, season);
    const seasons = getSeasons();
    return NextResponse.json({
      standings: standingsResult.data,
      seasons,
      seasonType: standingsResult.seasonType,
      playoffAvailable: standingsResult.playoffAvailable,
    });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
