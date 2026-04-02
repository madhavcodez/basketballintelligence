import { NextRequest, NextResponse } from 'next/server';
import { getLineupsV2, parseSeasonType } from '@/lib/playoffs-db';
import { handleApiError } from '@/lib/api-error';
import { jsonWithCache } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const teamRaw = searchParams.get('team');

    if (!teamRaw) {
      return NextResponse.json(
        { error: 'Query parameter "team" is required' },
        { status: 400 },
      );
    }

    const team = decodeURIComponent(teamRaw);
    const seasonType = parseSeasonType(searchParams.get('seasonType'));
    const season = searchParams.get('season')
      ? decodeURIComponent(searchParams.get('season')!)
      : undefined;

    const result = getLineupsV2(team, seasonType, season);

    return jsonWithCache({
      data: result.data,
      seasonType: result.seasonType,
      playoffAvailable: result.playoffAvailable,
    }, 120);
  } catch (e) { return handleApiError(e, 'v2-lineups'); }
}
