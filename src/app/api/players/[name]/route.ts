import { NextRequest, NextResponse } from 'next/server';
import { getPlayer, getPlayerStats, getPlayerAdvanced, getPlayerAwards, getDraftPick } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const playerName = decodeURIComponent(name);
  try {
    const player = getPlayer(playerName);
    if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    const stats = getPlayerStats(playerName);
    const advanced = getPlayerAdvanced(playerName);
    const awards = getPlayerAwards(playerName);
    const draft = getDraftPick(playerName);
    return NextResponse.json({ player, stats, advanced, awards, draft });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
