import { NextRequest, NextResponse } from 'next/server';
import { getStandingsV2, parseSeasonType } from '@/lib/playoffs-db';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const seasonType = parseSeasonType(searchParams.get('seasonType'));
    const season = searchParams.get('season')
      ? decodeURIComponent(searchParams.get('season')!)
      : undefined;

    const result = getStandingsV2(seasonType, season);

    return NextResponse.json({
      data: result.data,
      seasonType: result.seasonType,
      playoffAvailable: result.playoffAvailable,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch standings' },
      { status: 500 },
    );
  }
}
