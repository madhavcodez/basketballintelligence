import { NextResponse } from 'next/server';
import { getAllTags } from '@/lib/film-db';
import { handleApiError } from '@/lib/api-error';

export async function GET() {
  try {
    const tags = getAllTags();
    const categories = [...new Set(tags.map((t) => t.category))];

    return NextResponse.json({ tags, categories });
  } catch (e) { return handleApiError(e, 'film-tags'); }
}
