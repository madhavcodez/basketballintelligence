import { NextResponse } from 'next/server';
import { getArchetypeQuiz } from '@/lib/db';

export async function GET() {
  try {
    const data = getArchetypeQuiz();

    if (!data) {
      return NextResponse.json(
        { error: 'Unable to generate archetype quiz' },
        { status: 404 },
      );
    }

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json(
      { error: 'Failed to generate archetype quiz' },
      { status: 500 },
    );
  }
}
