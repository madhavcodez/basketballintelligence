import { NextRequest, NextResponse } from 'next/server';
import { searchPlayers } from '@/lib/db';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') || '';
  const limit = request.nextUrl.searchParams.get('limit') || '20';
  const offset = request.nextUrl.searchParams.get('offset') || '0';
  if (q.length < 2) return NextResponse.json([]);
  try {
    const players = searchPlayers(q, limit, offset);
    return NextResponse.json(players);
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
