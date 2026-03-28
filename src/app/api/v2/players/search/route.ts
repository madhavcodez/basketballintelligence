import { NextRequest, NextResponse } from 'next/server';
import { searchPlayers } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const q = params.get('q');
    const limit = params.get('limit') ?? '20';
    const offset = params.get('offset') ?? '0';

    if (!q || q.length < 2) {
      return NextResponse.json(
        { error: 'Query parameter "q" must be at least 2 characters' },
        { status: 400 },
      );
    }

    const decoded = decodeURIComponent(q);
    const data = searchPlayers(decoded, limit, offset);

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json(
      { error: 'Failed to search players' },
      { status: 500 },
    );
  }
}
