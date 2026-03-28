import { NextResponse } from 'next/server';
import { getPlayoffDataStatus } from '@/lib/playoffs-db';

export async function GET() {
  try {
    const status = getPlayoffDataStatus();
    return NextResponse.json({
      regular: true,
      playoffs: status.hasPlayoffStats || status.hasPlayoffShots,
      playoffSeasons: status.playoffSeasons,
      details: status,
    });
  } catch {
    return NextResponse.json(
      { regular: true, playoffs: false, playoffSeasons: [], details: null },
      { status: 500 },
    );
  }
}
