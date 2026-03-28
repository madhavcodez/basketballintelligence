import { NextRequest, NextResponse } from 'next/server';
import { getPlayerShotsV2, parseSeasonType } from '@/lib/playoffs-db';

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
    const offset = searchParams.get('offset')
      ? parseInt(searchParams.get('offset')!, 10)
      : undefined;

    const result = getPlayerShotsV2(decoded, seasonType, season, limit, offset);

    return NextResponse.json({
      data: result.data,
      seasonType: result.seasonType,
      playoffAvailable: result.playoffAvailable,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch player shots' },
      { status: 500 },
    );
  }
}
