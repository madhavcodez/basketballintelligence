import { NextRequest, NextResponse } from 'next/server';
import { getTeamStats, getTeamAdvanced } from '@/lib/db';
import { parseSeasonType, getTeamRosterV2, getLineupsV2 } from '@/lib/playoffs-db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ abbr: string }> }
) {
  const { abbr } = await params;
  const season = request.nextUrl.searchParams.get('season') || undefined;
  const seasonType = parseSeasonType(request.nextUrl.searchParams.get('seasonType'));
  try {
    const stats = getTeamStats(abbr);
    if (stats.length === 0) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    const rosterResult = getTeamRosterV2(abbr, seasonType, season);
    const lineupsResult = getLineupsV2(abbr, seasonType, season);
    const teamName = (stats[0] as Record<string, unknown>)?.teamName as string | undefined;
    const advanced = teamName ? getTeamAdvanced(teamName) : [];
    return NextResponse.json({
      stats,
      roster: rosterResult.data,
      lineups: lineupsResult.data,
      advanced,
      seasonType: rosterResult.seasonType,
      playoffAvailable: rosterResult.playoffAvailable,
    });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
