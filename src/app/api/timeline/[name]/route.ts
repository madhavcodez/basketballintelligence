import { NextRequest, NextResponse } from 'next/server';
import { buildTimeline } from '@/lib/timeline-engine';
import { findPlayerName } from '@/lib/matchup-engine';

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

    return NextResponse.json(timeline);
  } catch {
    return NextResponse.json(
      { error: 'Failed to build timeline' },
      { status: 500 }
    );
  }
}
