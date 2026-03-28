import { NextRequest, NextResponse } from 'next/server';
import { getShotZoneStatsV2, parseSeasonType } from '@/lib/playoffs-db';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const playerRaw = searchParams.get('player');
    const seasonType = parseSeasonType(searchParams.get('seasonType'));
    const season = searchParams.get('season')
      ? decodeURIComponent(searchParams.get('season')!)
      : undefined;

    if (!playerRaw) {
      return NextResponse.json(
        { error: 'Query parameter "player" is required' },
        { status: 400 },
      );
    }

    const player = decodeURIComponent(playerRaw);
    const result = getShotZoneStatsV2(player, seasonType, season);

    return NextResponse.json({
      data: result.data,
      seasonType: result.seasonType,
      playoffAvailable: result.playoffAvailable,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch shot zone stats' },
      { status: 500 },
    );
  }
}
