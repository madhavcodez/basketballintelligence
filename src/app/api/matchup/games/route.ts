import { NextRequest, NextResponse } from 'next/server';
import { findPlayerName, getSharedGames } from '@/lib/matchup-engine';

export async function GET(request: NextRequest) {
  const p1 = request.nextUrl.searchParams.get('p1');
  const p2 = request.nextUrl.searchParams.get('p2');
  const limitParam = request.nextUrl.searchParams.get('limit') ?? '20';
  const offsetParam = request.nextUrl.searchParams.get('offset') ?? '0';

  if (!p1 || !p2) {
    return NextResponse.json(
      { error: 'Both p1 and p2 query parameters are required' },
      { status: 400 },
    );
  }

  const limit = Math.max(1, Math.min(parseInt(limitParam, 10) || 20, 100));
  const offset = Math.max(0, parseInt(offsetParam, 10) || 0);

  try {
    const player1Name = findPlayerName(p1);
    const player2Name = findPlayerName(p2);

    if (!player1Name || !player2Name) {
      return NextResponse.json(
        { error: 'One or both players not found' },
        { status: 404 },
      );
    }

    const allGames = getSharedGames(player1Name, player2Name);
    const sliced = allGames.slice(offset, offset + limit);

    return NextResponse.json({
      games: sliced,
      total: allGames.length,
    });
  } catch {
    return NextResponse.json(
      { error: 'Database error' },
      { status: 500 },
    );
  }
}
