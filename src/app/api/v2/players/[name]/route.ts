import { NextRequest, NextResponse } from 'next/server';
import { getPlayer, getPlayerAwards, getDraftPick } from '@/lib/db';
import { getPlayerStatsV2, getPlayerAdvancedV2, parseSeasonType } from '@/lib/playoffs-db';

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

    const stats = getPlayerStatsV2(decoded, seasonType);
    const advanced = getPlayerAdvancedV2(decoded, seasonType);
    const awards = getPlayerAwards(decoded);
    const draft = getDraftPick(decoded);

    return NextResponse.json({
      player,
      stats,
      advanced,
      awards,
      draft,
      seasonType: stats.seasonType,
      playoffAvailable: stats.playoffAvailable,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch player data' },
      { status: 500 },
    );
  }
}
