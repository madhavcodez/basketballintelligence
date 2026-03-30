import { NextRequest, NextResponse } from 'next/server';
import { getPlayer, getPlayerAwards, getDraftPick } from '@/lib/db';
import { parseSeasonType, getPlayerStatsV2, getPlayerAdvancedV2 } from '@/lib/playoffs-db';
import { handleApiError } from '@/lib/api-error';
import { jsonWithCache } from '@/lib/api-response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const playerName = decodeURIComponent(name);
  const seasonType = parseSeasonType(request.nextUrl.searchParams.get('seasonType'));
  try {
    const player = getPlayer(playerName);
    if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    const statsResult = getPlayerStatsV2(playerName, seasonType);
    const advancedResult = getPlayerAdvancedV2(playerName, seasonType);
    const awards = getPlayerAwards(playerName);
    const draft = getDraftPick(playerName);
    return jsonWithCache({
      player,
      stats: statsResult.data,
      advanced: advancedResult.data,
      awards,
      draft,
      seasonType: statsResult.seasonType,
      playoffAvailable: statsResult.playoffAvailable,
    }, 120);
  } catch (e) { return handleApiError(e, 'player-detail'); }
}
