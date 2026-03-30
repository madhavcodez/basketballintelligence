import { NextResponse } from 'next/server';
import { getArchetypeQuiz } from '@/lib/db';
import { handleApiError } from '@/lib/api-error';

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
  } catch (e) { return handleApiError(e, 'v2-quiz-archetype'); }
}
