import { NextRequest, NextResponse } from 'next/server';
import { getLineups } from '@/lib/db';

export async function GET(request: NextRequest) {
  const team = request.nextUrl.searchParams.get('team');
  const season = request.nextUrl.searchParams.get('season') || undefined;
  if (!team) return NextResponse.json({ error: 'Team required' }, { status: 400 });
  try {
    const lineups = getLineups(team, season);
    return NextResponse.json(lineups);
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
