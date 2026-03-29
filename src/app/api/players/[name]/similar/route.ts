import { NextRequest, NextResponse } from 'next/server';
import { parseSeasonType, findSimilarPlayersV2 } from '@/lib/playoffs-db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const playerName = decodeURIComponent(name);
  const season = request.nextUrl.searchParams.get('season') || '2024-25';
  const seasonType = parseSeasonType(request.nextUrl.searchParams.get('seasonType'));
  try {
    const result = findSimilarPlayersV2(playerName, seasonType, season);
    return NextResponse.json({
      data: result.data,
      seasonType: result.seasonType,
      playoffAvailable: result.playoffAvailable,
    });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
