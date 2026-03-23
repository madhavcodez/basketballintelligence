import { NextResponse } from 'next/server';
import { getShotChartQuiz } from '@/lib/db';

/**
 * GET /api/quiz/shot-chart
 *
 * Returns an anonymised shot-zone profile for a random player plus four name
 * options (correct answer included) so the frontend can render a "Guess whose
 * shot chart is this?" game.
 *
 * Response shape:
 * {
 *   zones: { zone: string; attPct: number; fgPct: number }[];
 *   options: string[];          // 4 player names, shuffled
 *   correctAnswer: string;
 *   season: string;             // e.g. "2023-24"
 *   totalShots: number;
 * }
 */
export async function GET() {
  try {
    const quiz = getShotChartQuiz();
    if (!quiz) {
      return NextResponse.json({ error: 'No shot data available' }, { status: 503 });
    }
    return NextResponse.json(quiz);
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
