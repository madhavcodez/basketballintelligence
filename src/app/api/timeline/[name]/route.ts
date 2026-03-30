import { NextRequest, NextResponse } from 'next/server';
import { buildTimeline } from '@/lib/timeline-engine';
import { findPlayerName } from '@/lib/matchup-engine';
import { handleApiError } from '@/lib/api-error';
import { jsonWithCache } from '@/lib/api-response';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const decoded = decodeURIComponent(name);

  try {
    // Try exact name first, then fuzzy match
    const resolvedName = findPlayerName(decoded) ?? decoded;
    const timeline = buildTimeline(resolvedName);

    if (!timeline) {
      return NextResponse.json(
        { error: `Player "${decoded}" not found` },
        { status: 404 }
      );
    }

    return jsonWithCache(timeline, 120);
  } catch (e) { return handleApiError(e, 'timeline'); }
}
