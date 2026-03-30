import { NextResponse } from 'next/server';
import { getShotChartQuiz } from '@/lib/db';
import { handleApiError } from '@/lib/api-error';

/**
 * GET /api/quiz/shot-chart
 */
export async function GET() {
  try {
    const quiz = getShotChartQuiz();
    if (!quiz) {
      return NextResponse.json({ error: 'No shot data available' }, { status: 503 });
    }
    return NextResponse.json(quiz);
  } catch (e) { return handleApiError(e, 'quiz-shot-chart'); }
}
