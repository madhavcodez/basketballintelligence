import { NextRequest, NextResponse } from 'next/server';
import { getTeamStats, getTeamAdvanced } from '@/lib/db';
import { getTeamRosterV2, parseSeasonType } from '@/lib/playoffs-db';
import { handleApiError } from '@/lib/api-error';
import { jsonWithCache } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ abbr: string }> },
) {
  try {
    const { abbr } = await params;
    const decoded = decodeURIComponent(abbr);
    const seasonType = parseSeasonType(req.nextUrl.searchParams.get('seasonType'));

    const stats = getTeamStats(decoded);

    if (stats.length === 0) {
      return NextResponse.json(
        { error: `Team "${decoded}" not found` },
        { status: 404 },
      );
    }

    const roster = getTeamRosterV2(decoded, seasonType);

    // getTeamAdvanced expects team name, but we have abbreviation.
    const teamName = (stats[0] as Record<string, unknown> | undefined)?.teamName as string | undefined;
    const advanced = teamName ? getTeamAdvanced(teamName) : [];

    return jsonWithCache({
      team: decoded,
      stats,
      roster: {
        data: roster.data,
        seasonType: roster.seasonType,
        playoffAvailable: roster.playoffAvailable,
      },
      advanced,
    }, 300);
  } catch (e) { return handleApiError(e, 'v2-team-detail'); }
}
