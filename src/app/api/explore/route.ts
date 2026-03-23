import { NextResponse } from 'next/server';
import { getFeaturedPlayers, getTopScorers, getSeasons, getDataEdition, getStandings, getCareerLeaders } from '@/lib/db';

export async function GET() {
  try {
    const featured = getFeaturedPlayers(12);
    const topScorers = getTopScorers(undefined, 10);
    const seasons = getSeasons();
    const edition = getDataEdition();
    const standings = getStandings();
    const allTimeScorers = getCareerLeaders('pts', 10);
    return NextResponse.json({ featured, topScorers, seasons, edition, standings, allTimeScorers });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
