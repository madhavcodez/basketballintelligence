import { NextRequest, NextResponse } from 'next/server';
import { getPlayerShots, getShotZoneStats, getPlayerShotSeasons } from '@/lib/db';

export async function GET(request: NextRequest) {
  const player = request.nextUrl.searchParams.get('player');
  const season = request.nextUrl.searchParams.get('season') || undefined;
  const limit = request.nextUrl.searchParams.get('limit') || '5000';
  const offset = request.nextUrl.searchParams.get('offset') || '0';
  if (!player) return NextResponse.json({ error: 'Player required' }, { status: 400 });
  try {
    const shots = getPlayerShots(player, season, limit, offset);
    const zones = getShotZoneStats(player, season);
    const seasons = getPlayerShotSeasons(player);
    return NextResponse.json({ shots, zones, seasons });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
