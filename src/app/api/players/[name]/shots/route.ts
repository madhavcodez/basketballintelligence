import { NextRequest, NextResponse } from 'next/server';
import { getPlayerShotSeasons } from '@/lib/db';
import { parseSeasonType, getPlayerShotsV2, getShotZoneStatsV2 } from '@/lib/playoffs-db';
import { handleApiError } from '@/lib/api-error';
import { jsonWithCache } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const playerName = decodeURIComponent(name);
  const season = request.nextUrl.searchParams.get('season') || undefined;
  const zonesOnly = request.nextUrl.searchParams.get('zones') === 'true';
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '5000', 10);
  const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0', 10);
  const seasonType = parseSeasonType(request.nextUrl.searchParams.get('seasonType'));
  try {
    const seasons = getPlayerShotSeasons(playerName);
    if (zonesOnly) {
      const zonesResult = getShotZoneStatsV2(playerName, seasonType, season);
      return jsonWithCache({
        seasons,
        zones: zonesResult.data,
        seasonType: zonesResult.seasonType,
        playoffAvailable: zonesResult.playoffAvailable,
      }, 120);
    }
    const shotsResult = getPlayerShotsV2(playerName, seasonType, season, limit, offset);
    const zonesResult = getShotZoneStatsV2(playerName, seasonType, season);
    return jsonWithCache({
      seasons,
      shots: shotsResult.data,
      zones: zonesResult.data,
      seasonType: shotsResult.seasonType,
      playoffAvailable: shotsResult.playoffAvailable,
    }, 120);
  } catch (e) { return handleApiError(e, 'player-shots'); }
}
