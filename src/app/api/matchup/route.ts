import { NextRequest, NextResponse } from 'next/server';
import { findPlayerName, getMatchupSummary } from '@/lib/matchup-engine';
import { getDb } from '@/lib/db';

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

    const db = getDb();
    const p1Row = db.prepare('SELECT person_id FROM players WHERE Player = ?').get(player1Name) as { person_id: string | number } | undefined;
    const p2Row = db.prepare('SELECT person_id FROM players WHERE Player = ?').get(player2Name) as { person_id: string | number } | undefined;

    return NextResponse.json({
      ...summary,
      p1PersonId: p1Row?.person_id ?? null,
      p2PersonId: p2Row?.person_id ?? null,
    });
  } catch {
    return NextResponse.json(
      { error: 'Database error' },
      { status: 500 },
    );
  }
}
