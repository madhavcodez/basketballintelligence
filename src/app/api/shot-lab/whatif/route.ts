import { NextRequest, NextResponse } from 'next/server';
import { modelWhatIfShotMix, getShotLabSeasons } from '@/lib/db';

// GET /api/shot-lab/whatif?player=Stephen+Curry&season=2024-25&adjustments=[...]
//
// adjustments: JSON array of shift objects:
//   [{ "fromZone": "Mid-Range", "fromArea": "Center(C)",
//      "toZone": "Above the Break 3", "toArea": "Center(C)",
//      "shiftPct": 5 }]
//
// Returns expected points per 100 attempts (ePtsPer100) baseline vs adjusted.
export async function GET(request: NextRequest) {
  const player = request.nextUrl.searchParams.get('player');
  const season = request.nextUrl.searchParams.get('season') || undefined;
  const rawAdj = request.nextUrl.searchParams.get('adjustments');

  if (!player) {
    return NextResponse.json({ error: 'player is required' }, { status: 400 });
  }

  // Resolve season
  let targetSeason = season;
  if (!targetSeason) {
    const seasons = getShotLabSeasons(player);
    if (seasons.length === 0) {
      return NextResponse.json(
        { error: `No shot data found for player: ${player}` },
        { status: 404 }
      );
    }
    targetSeason = seasons[0];
  }

  // Parse adjustments (default to empty = baseline only)
  let adjustments: Array<{
    fromZone: string;
    fromArea: string;
    toZone: string;
    toArea: string;
    shiftPct: number;
  }> = [];

  if (rawAdj) {
    try {
      adjustments = JSON.parse(rawAdj);
      if (!Array.isArray(adjustments)) throw new Error('adjustments must be an array');
    } catch {
      return NextResponse.json(
        { error: 'Invalid adjustments JSON. Expected array of { fromZone, fromArea, toZone, toArea, shiftPct }.' },
        { status: 400 }
      );
    }
  }

  try {
    const result = modelWhatIfShotMix(player, targetSeason, adjustments);
    if (!result) {
      return NextResponse.json(
        { error: `No shot data found for ${player} in ${targetSeason}` },
        { status: 404 }
      );
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
