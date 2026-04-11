import { NextRequest } from 'next/server';
import { getPlayerShotsV2, parseSeasonType } from '@/lib/playoffs-db';
import { handleApiError } from '@/lib/api-error';
import { jsonWithCache } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const SHOTS_MAX_LIMIT = 10000;

function parseClampedInt(raw: string | null, fallback: number, min: number, max: number): number {
  if (raw === null) return fallback;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

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
    const limit = parseClampedInt(searchParams.get('limit'), 5000, 1, SHOTS_MAX_LIMIT);
    const offset = parseClampedInt(searchParams.get('offset'), 0, 0, Number.MAX_SAFE_INTEGER);

    const result = getPlayerShotsV2(decoded, seasonType, season, limit, offset);

    return jsonWithCache({
      data: result.data,
      seasonType: result.seasonType,
      playoffAvailable: result.playoffAvailable,
    }, 120);
  } catch (e) { return handleApiError(e, 'v2-player-shots'); }
}
