import { NextRequest, NextResponse } from 'next/server';
import { getStandings, getSeasons } from '@/lib/db';

export async function GET(request: NextRequest) {
  const season = request.nextUrl.searchParams.get('season') || undefined;
  try {
    const standings = getStandings(season);
    const seasons = getSeasons();
    return NextResponse.json({ standings, seasons });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
