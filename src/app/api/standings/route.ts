import { NextRequest } from 'next/server';
import { getSeasons } from '@/lib/db';
import { parseSeasonType, getStandingsV2 } from '@/lib/playoffs-db';
import { handleApiError } from '@/lib/api-error';
import { jsonWithCache } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const season = request.nextUrl.searchParams.get('season') || undefined;
  const seasonType = parseSeasonType(request.nextUrl.searchParams.get('seasonType'));
  try {
    const standingsResult = getStandingsV2(seasonType, season);
    const seasons = getSeasons();
    return jsonWithCache({
      standings: standingsResult.data,
      seasons,
      seasonType: standingsResult.seasonType,
      playoffAvailable: standingsResult.playoffAvailable,
    }, 300);
  } catch (e) { return handleApiError(e, 'standings'); }
}
