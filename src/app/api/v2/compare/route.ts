import { NextRequest, NextResponse } from 'next/server';
import { comparePlayersV2, getShotZoneStatsV2, parseSeasonType } from '@/lib/playoffs-db';
import { handleApiError } from '@/lib/api-error';
import { jsonWithCache } from '@/lib/api-response';

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

    const comparison = comparePlayersV2(p1, p2, seasonType, season);
    const p1Zones = getShotZoneStatsV2(p1, seasonType, season);
    const p2Zones = getShotZoneStatsV2(p2, seasonType, season);

    return jsonWithCache({
      player1: comparison.player1,
      player2: comparison.player2,
      shotZones: {
        player1: p1Zones.data,
        player2: p2Zones.data,
      },
      seasonType: comparison.seasonType,
      playoffAvailable: comparison.playoffAvailable,
    }, 120);
  } catch (e) { return handleApiError(e, 'v2-compare'); }
}
