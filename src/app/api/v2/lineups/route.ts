import { NextRequest, NextResponse } from 'next/server';
import { getLineupsV2, parseSeasonType } from '@/lib/playoffs-db';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const teamRaw = searchParams.get('team');

    if (!teamRaw) {
      return NextResponse.json(
        { error: 'Query parameter "team" is required' },
        { status: 400 },
      );
    }

    const team = decodeURIComponent(teamRaw);
    const seasonType = parseSeasonType(searchParams.get('seasonType'));
    const season = searchParams.get('season')
      ? decodeURIComponent(searchParams.get('season')!)
      : undefined;

    const result = getLineupsV2(team, seasonType, season);

    return NextResponse.json({
      data: result.data,
      seasonType: result.seasonType,
      playoffAvailable: result.playoffAvailable,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch lineups' },
      { status: 500 },
    );
  }
}
