import { NextRequest, NextResponse } from 'next/server';
import { getPlayer, getPlayerAwards, getDraftPick } from '@/lib/db';
import { getPlayerStatsV2, getPlayerAdvancedV2, parseSeasonType } from '@/lib/playoffs-db';
import { handleApiError } from '@/lib/api-error';
import { jsonWithCache } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    const { name } = await params;
    const decoded = decodeURIComponent(name);
    const seasonType = parseSeasonType(req.nextUrl.searchParams.get('seasonType'));

    const player = getPlayer(decoded);

    if (!player) {
      return NextResponse.json(
        { error: `Player "${decoded}" not found` },
        { status: 404 },
      );
    }

    const statsResult = getPlayerStatsV2(decoded, seasonType);
    const advancedResult = getPlayerAdvancedV2(decoded, seasonType);
    const awards = getPlayerAwards(decoded);
    const draft = getDraftPick(decoded);

    // Match v1 response shape: clients expect `stats` to be the row array,
    // not the wrapped { data, seasonType, playoffAvailable } envelope.
    return jsonWithCache({
      player,
      stats: statsResult.data,
      advanced: advancedResult.data,
      awards,
      draft,
      seasonType: statsResult.seasonType,
      playoffAvailable: statsResult.playoffAvailable,
    }, 120);
  } catch (e) { return handleApiError(e, 'v2-player-detail'); }
}
