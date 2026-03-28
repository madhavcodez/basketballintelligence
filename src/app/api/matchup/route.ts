import { NextRequest, NextResponse } from 'next/server';
import { findPlayerName, getMatchupSummary } from '@/lib/matchup-engine';

export async function GET(request: NextRequest) {
  const p1 = request.nextUrl.searchParams.get('p1');
  const p2 = request.nextUrl.searchParams.get('p2');

  if (!p1 || !p2) {
    return NextResponse.json(
      { error: 'Both p1 and p2 query parameters are required' },
      { status: 400 },
    );
  }

  try {
    const player1Name = findPlayerName(p1);
    const player2Name = findPlayerName(p2);

    if (!player1Name) {
      return NextResponse.json(
        { error: `Player not found: ${p1}` },
        { status: 404 },
      );
    }

    if (!player2Name) {
      return NextResponse.json(
        { error: `Player not found: ${p2}` },
        { status: 404 },
      );
    }

    const summary = getMatchupSummary(player1Name, player2Name);

    if (!summary) {
      return NextResponse.json(
        {
          error: 'No shared games found between these players',
          player1: player1Name,
          player2: player2Name,
        },
        { status: 404 },
      );
    }

    return NextResponse.json(summary);
  } catch {
    return NextResponse.json(
      { error: 'Database error' },
      { status: 500 },
    );
  }
}
