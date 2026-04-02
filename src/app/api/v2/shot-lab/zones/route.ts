import { NextRequest, NextResponse } from 'next/server';
import { getShotZoneStatsV2, parseSeasonType } from '@/lib/playoffs-db';
import { handleApiError } from '@/lib/api-error';
import { jsonWithCache } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

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

    return jsonWithCache({
      data: result.data,
      seasonType: result.seasonType,
      playoffAvailable: result.playoffAvailable,
    }, 120);
  } catch (e) { return handleApiError(e, 'v2-shot-lab-zones'); }
}
