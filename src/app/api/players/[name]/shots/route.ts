import { NextRequest, NextResponse } from 'next/server';
import { getPlayerShots, getPlayerShotSeasons, getShotZoneStats } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const playerName = decodeURIComponent(name);
  const season = request.nextUrl.searchParams.get('season') || undefined;
  const zonesOnly = request.nextUrl.searchParams.get('zones') === 'true';
  const limit = request.nextUrl.searchParams.get('limit') || '5000';
  const offset = request.nextUrl.searchParams.get('offset') || '0';
  try {
    const seasons = getPlayerShotSeasons(playerName);
    if (zonesOnly) {
      const zones = getShotZoneStats(playerName, season);
      return NextResponse.json({ seasons, zones });
    }
    const shots = getPlayerShots(playerName, season, limit, offset);
    const zones = getShotZoneStats(playerName, season);
    return NextResponse.json({ seasons, shots, zones });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
