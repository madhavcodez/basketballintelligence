import { NextRequest, NextResponse } from 'next/server';
import { findSimilarPlayers } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const playerName = decodeURIComponent(name);
  const season = request.nextUrl.searchParams.get('season') || '2024-25';
  try {
    const similar = findSimilarPlayers(playerName, season);
    return NextResponse.json(similar);
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
