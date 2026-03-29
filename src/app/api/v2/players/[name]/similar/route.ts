import { NextRequest, NextResponse } from 'next/server';
import { findSimilarPlayersV2, parseSeasonType } from '@/lib/playoffs-db';
import { findSimilarPlayersAdvanced } from '@/lib/similarity-engine';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    const { name } = await params;
    const decoded = decodeURIComponent(name);
    const searchParams = req.nextUrl.searchParams;

    const seasonType = parseSeasonType(searchParams.get('seasonType'));
    const season = searchParams.get('season')
      ? decodeURIComponent(searchParams.get('season')!)
      : undefined;
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!, 10)
      : undefined;
    const method = searchParams.get('method') ?? 'advanced';

    if (method === 'advanced') {
      const result = findSimilarPlayersAdvanced(decoded, seasonType, season, limit);

      if (result.data.length > 0) {
        return NextResponse.json({
          data: result.data,
          seasonType: result.seasonType,
          playoffAvailable: result.playoffAvailable,
          method: 'advanced',
        });
      }

      // Fall back to legacy when advanced yields no results
      const fallback = findSimilarPlayersV2(decoded, seasonType, season, limit);
      return NextResponse.json({
        data: fallback.data,
        seasonType: fallback.seasonType,
        playoffAvailable: fallback.playoffAvailable,
        method: 'legacy',
      });
    }

    // Explicit legacy mode
    const result = findSimilarPlayersV2(decoded, seasonType, season, limit);
    return NextResponse.json({
      data: result.data,
      seasonType: result.seasonType,
      playoffAvailable: result.playoffAvailable,
      method: 'legacy',
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to find similar players' },
      { status: 500 },
    );
  }
}
