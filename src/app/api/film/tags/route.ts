import { NextRequest, NextResponse } from 'next/server';
import { getAllTags } from '@/lib/film-db';

export async function GET(_request: NextRequest) {
  try {
    const tags = getAllTags();
    const categories = [...new Set(tags.map((t) => t.category))];

    return NextResponse.json({ tags, categories });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
