import { NextRequest } from 'next/server';
import { getCareerLeaders, getDataEdition } from '@/lib/db';
import { getTopScorersV2, getStandingsV2, parseSeasonType } from '@/lib/playoffs-db';
import { handleApiError } from '@/lib/api-error';
import { jsonWithCache } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const seasonType = parseSeasonType(req.nextUrl.searchParams.get('seasonType'));

    const topScorers = getTopScorersV2(seasonType);
    const standings = getStandingsV2(seasonType);
    const careerLeaders = getCareerLeaders('pts');
    const dataEdition = getDataEdition();

    return jsonWithCache({
      topScorers: {
        data: topScorers.data,
        seasonType: topScorers.seasonType,
        playoffAvailable: topScorers.playoffAvailable,
      },
      standings: {
        data: standings.data,
        seasonType: standings.seasonType,
        playoffAvailable: standings.playoffAvailable,
      },
      careerLeaders,
      dataEdition,
    }, 300);
  } catch (e) { return handleApiError(e, 'v2-explore'); }
}
