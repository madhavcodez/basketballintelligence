import { NextRequest, NextResponse } from 'next/server';
import { compareShotZoneProfiles } from '@/lib/db';
import { handleApiError } from '@/lib/api-error';
import { jsonWithCache } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

// GET /api/shot-lab/compare?player1=LeBron+James&player2=Kevin+Durant&season=2024-25
// Returns zone-by-zone shot distribution comparison for two players + league baseline.
export async function GET(request: NextRequest) {
  const player1 = request.nextUrl.searchParams.get('player1');
  const player2 = request.nextUrl.searchParams.get('player2');
  const season = request.nextUrl.searchParams.get('season') || undefined;

  if (!player1 || !player2) {
    return NextResponse.json(
      { error: 'Both player1 and player2 are required' },
      { status: 400 }
    );
  }

  try {
    const result = compareShotZoneProfiles(player1, player2, season);

    if (result.player1.length === 0 && result.player2.length === 0) {
      return NextResponse.json(
        { error: 'No shot data found for either player' },
        { status: 404 }
      );
    }

    return jsonWithCache(result, 120);
  } catch (e) { return handleApiError(e, 'shot-lab-compare'); }
}
