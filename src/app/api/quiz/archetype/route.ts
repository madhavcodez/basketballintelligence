import { NextResponse } from 'next/server';
import { getArchetypeQuiz } from '@/lib/db';
import { handleApiError } from '@/lib/api-error';

/**
 * GET /api/quiz/archetype
 */
export async function GET() {
  try {
    const quiz = getArchetypeQuiz();
    if (!quiz) {
      return NextResponse.json({ error: 'No archetype data available' }, { status: 503 });
    }
    return NextResponse.json(quiz);
  } catch (e) { return handleApiError(e, 'quiz-archetype'); }
}
