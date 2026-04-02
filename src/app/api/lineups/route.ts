import { NextRequest, NextResponse } from 'next/server';
import { parseSeasonType, getLineupsV2 } from '@/lib/playoffs-db';
import { handleApiError } from '@/lib/api-error';
import { jsonWithCache } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const team = request.nextUrl.searchParams.get('team');
  const season = request.nextUrl.searchParams.get('season') || undefined;
  const seasonType = parseSeasonType(request.nextUrl.searchParams.get('seasonType'));
  if (!team) return NextResponse.json({ error: 'Team required' }, { status: 400 });
  try {
    const result = getLineupsV2(team, seasonType, season);
    return jsonWithCache({
      data: result.data,
      seasonType: result.seasonType,
      playoffAvailable: result.playoffAvailable,
    }, 120);
  } catch (e) { return handleApiError(e, 'lineups'); }
}
