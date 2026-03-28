import { NextRequest, NextResponse } from 'next/server';
import { getShotZoneStatsV2, parseSeasonType } from '@/lib/playoffs-db';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const p1Raw = searchParams.get('p1');
    const p2Raw = searchParams.get('p2');

    if (!p1Raw || !p2Raw) {
      return NextResponse.json(
        { error: 'Both "p1" and "p2" query parameters are required' },
        { status: 400 },
      );
    }

    const p1 = decodeURIComponent(p1Raw);
    const p2 = decodeURIComponent(p2Raw);
    const seasonType = parseSeasonType(searchParams.get('seasonType'));
    const season = searchParams.get('season')
      ? decodeURIComponent(searchParams.get('season')!)
      : undefined;

    const p1Zones = getShotZoneStatsV2(p1, seasonType, season);
    const p2Zones = getShotZoneStatsV2(p2, seasonType, season);

    return NextResponse.json({
      player1: {
        name: p1,
        zones: p1Zones.data,
      },
      player2: {
        name: p2,
        zones: p2Zones.data,
      },
      seasonType: p1Zones.seasonType,
      playoffAvailable: p1Zones.playoffAvailable && p2Zones.playoffAvailable,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to compare shot zones' },
      { status: 500 },
    );
  }
}
