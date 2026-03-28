import { NextRequest, NextResponse } from 'next/server';
import { getCareerLeaders, getDataEdition } from '@/lib/db';
import { getTopScorersV2, getStandingsV2, parseSeasonType } from '@/lib/playoffs-db';

export async function GET(req: NextRequest) {
  try {
    const seasonType = parseSeasonType(req.nextUrl.searchParams.get('seasonType'));

    const topScorers = getTopScorersV2(seasonType);
    const standings = getStandingsV2(seasonType);
    const careerLeaders = getCareerLeaders('pts');
    const dataEdition = getDataEdition();

    return NextResponse.json({
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
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch explore data' },
      { status: 500 },
    );
  }
}
