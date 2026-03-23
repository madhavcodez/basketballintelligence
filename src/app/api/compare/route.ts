import { NextRequest, NextResponse } from 'next/server';
import { comparePlayers, getShotZoneStats } from '@/lib/db';

export async function GET(request: NextRequest) {
  const p1 = request.nextUrl.searchParams.get('p1');
  const p2 = request.nextUrl.searchParams.get('p2');
  const season = request.nextUrl.searchParams.get('season') || undefined;
  if (!p1 || !p2) return NextResponse.json({ error: 'Two players required' }, { status: 400 });
  try {
    const comparison = comparePlayers(p1, p2, season);
    const zones1 = getShotZoneStats(p1, season);
    const zones2 = getShotZoneStats(p2, season);
    return NextResponse.json({ ...comparison, zones1, zones2 });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
