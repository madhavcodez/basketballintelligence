import { NextRequest } from 'next/server';
import { findSimilarPlayersV2, parseSeasonType } from '@/lib/playoffs-db';
import { findSimilarPlayersAdvanced } from '@/lib/similarity-engine';
import { handleApiError } from '@/lib/api-error';
import { jsonWithCache } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const SIMILAR_MAX_LIMIT = 50;

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
    const rawLimit = searchParams.get('limit');
    const parsedLimit = rawLimit ? parseInt(rawLimit, 10) : NaN;
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), SIMILAR_MAX_LIMIT)
      : undefined;
    const method = searchParams.get('method') ?? 'advanced';

    if (method === 'advanced') {
      const result = findSimilarPlayersAdvanced(decoded, seasonType, season, limit);

      if (result.data.length > 0) {
        return jsonWithCache({
          data: result.data,
          seasonType: result.seasonType,
          playoffAvailable: result.playoffAvailable,
          method: 'advanced',
        }, 120);
      }

      // Fall back to legacy when advanced yields no results
      const fallback = findSimilarPlayersV2(decoded, seasonType, season, limit);
      return jsonWithCache({
        data: fallback.data,
        seasonType: fallback.seasonType,
        playoffAvailable: fallback.playoffAvailable,
        method: 'legacy',
      }, 120);
    }

    // Explicit legacy mode
    const result = findSimilarPlayersV2(decoded, seasonType, season, limit);
    return jsonWithCache({
      data: result.data,
      seasonType: result.seasonType,
      playoffAvailable: result.playoffAvailable,
      method: 'legacy',
    }, 120);
  } catch (e) { return handleApiError(e, 'v2-player-similar'); }
}
