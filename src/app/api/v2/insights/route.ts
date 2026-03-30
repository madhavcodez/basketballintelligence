import { NextRequest, NextResponse } from 'next/server';
import {
  getPlayerInsights,
  getTeamInsights,
  getExploreInsights,
} from '@/lib/insights-engine';
import { handleApiError } from '@/lib/api-error';
import { jsonWithCache } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const player = params.get('player');
    const team = params.get('team');
    const rawSeason = params.get('season');
    const season = rawSeason && /^\d{4}(-\d{2})?$/.test(rawSeason) ? rawSeason : undefined;

    if (player) {
      const decoded = decodeURIComponent(player).trim();
      if (!decoded || decoded.length > 200) {
        return NextResponse.json({ insights: [] });
      }
      const insights = getPlayerInsights(decoded, season);
      return jsonWithCache({ insights }, 120);
    }

    if (team) {
      const decoded = decodeURIComponent(team).trim().toUpperCase();
      if (!decoded || !/^[A-Z]{2,5}$/.test(decoded)) {
        return NextResponse.json({ insights: [] });
      }
      const insights = getTeamInsights(decoded, season);
      return jsonWithCache({ insights }, 120);
    }

    // Explore mode — no player/team specified
    const insights = getExploreInsights();
    return jsonWithCache({ insights }, 300);
  } catch (e) { return handleApiError(e, 'v2-insights'); }
}
