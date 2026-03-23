import { NextRequest, NextResponse } from 'next/server';
import { getPlayerZoneProfileWithLeague, getLeagueZoneBaseline, getShotLabSeasons } from '@/lib/db';

// GET /api/shot-lab/zones?player=LeBron+James&season=2024-25
// Returns player zone profile vs league average. If no player, returns league baseline only.
export async function GET(request: NextRequest) {
  const player = request.nextUrl.searchParams.get('player') || undefined;
  const season = request.nextUrl.searchParams.get('season') || undefined;

  try {
    if (!player) {
      const league = getLeagueZoneBaseline(season);
      return NextResponse.json({ league, season: season ?? null });
    }

    const zones = getPlayerZoneProfileWithLeague(player, season);
    const seasons = getShotLabSeasons(player);

    if (zones.length === 0) {
      return NextResponse.json(
        { error: `No shot data found for player: ${player}` },
        { status: 404 }
      );
    }

    return NextResponse.json({ player, season: season ?? seasons[0] ?? null, zones, seasons });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
