import { NextRequest, NextResponse } from 'next/server';
import { searchPlayers } from '@/lib/db';
import { handleApiError } from '@/lib/api-error';
import { jsonWithCache } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') || '';
  const rawLimit = parseInt(request.nextUrl.searchParams.get('limit') || '20', 10);
  const rawOffset = parseInt(request.nextUrl.searchParams.get('offset') || '0', 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 20;
  const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;
  if (q.length < 2) return NextResponse.json([]);
  try {
    const players = searchPlayers(q, limit, offset);
    return jsonWithCache(players, 60);
  } catch (e) { return handleApiError(e, 'players-search'); }
}
