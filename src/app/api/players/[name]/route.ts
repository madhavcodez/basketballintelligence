import { NextRequest, NextResponse } from 'next/server';
import { getPlayer, getPlayerAwards, getDraftPick } from '@/lib/db';
import { parseSeasonType, getPlayerStatsV2, getPlayerAdvancedV2 } from '@/lib/playoffs-db';

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
    return NextResponse.json({
      player,
      stats: statsResult.data,
      advanced: advancedResult.data,
      awards,
      draft,
      seasonType: statsResult.seasonType,
      playoffAvailable: statsResult.playoffAvailable,
    });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
