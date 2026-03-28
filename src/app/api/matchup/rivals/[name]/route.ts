import { NextRequest, NextResponse } from 'next/server';
import { findPlayerName, getTopRivals } from '@/lib/matchup-engine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const playerQuery = decodeURIComponent(name);
  const limitParam = request.nextUrl.searchParams.get('limit') ?? '10';
  const limit = Math.max(1, Math.min(parseInt(limitParam, 10) || 10, 50));

  try {
    const playerName = findPlayerName(playerQuery);

    if (!playerName) {
      return NextResponse.json(
        { error: `Player not found: ${playerQuery}` },
        { status: 404 },
      );
    }

    const rivals = getTopRivals(playerName, limit);

    return NextResponse.json({
      player: playerName,
      rivals,
    });
  } catch {
    return NextResponse.json(
      { error: 'Database error' },
      { status: 500 },
    );
  }
}
