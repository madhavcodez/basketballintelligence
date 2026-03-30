import { NextRequest } from 'next/server';
import { getFeaturedPlayers, getSeasons, getDataEdition, getCareerLeaders } from '@/lib/db';
import { parseSeasonType, getTopScorersV2, getStandingsV2 } from '@/lib/playoffs-db';
import { handleApiError } from '@/lib/api-error';
import { jsonWithCache } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const seasonType = parseSeasonType(request.nextUrl.searchParams.get('seasonType'));
  try {
    const featured = getFeaturedPlayers(12);
    const topScorersResult = getTopScorersV2(seasonType, undefined, 10);
    const seasons = getSeasons();
    const edition = getDataEdition();
    const standingsResult = getStandingsV2(seasonType);
    const allTimeScorers = getCareerLeaders('pts', 10);
    return jsonWithCache({
      featured,
      topScorers: topScorersResult.data,
      seasons,
      edition,
      standings: standingsResult.data,
      allTimeScorers,
      seasonType: topScorersResult.seasonType,
      playoffAvailable: topScorersResult.playoffAvailable,
    }, 300);
  } catch (e) { return handleApiError(e, 'explore'); }
}
