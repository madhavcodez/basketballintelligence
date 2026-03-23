import { NextRequest, NextResponse } from 'next/server';
import { getTeamStats, getTeamRoster, getLineups, getTeamAdvanced } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ abbr: string }> }
) {
  const { abbr } = await params;
  const season = request.nextUrl.searchParams.get('season') || undefined;
  try {
    const stats = getTeamStats(abbr);
    if (stats.length === 0) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    const roster = getTeamRoster(abbr, season);
    const lineups = getLineups(abbr, season);
    const teamName = (stats[0] as Record<string, unknown>)?.teamName as string | undefined;
    const advanced = teamName ? getTeamAdvanced(teamName) : [];
    return NextResponse.json({ stats, roster, lineups, advanced });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
