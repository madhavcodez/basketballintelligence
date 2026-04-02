import { NextRequest, NextResponse } from 'next/server';
import {
  getPlayerForQuizByDifficulty,
  getBetterSeasonPair,
  getRandomPairForQuiz,
  type QuizDifficulty,
} from '@/lib/db';
import { handleApiError } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

/**
 * GET /api/quiz
 *
 * Query parameters:
 *   mode        — "guess" (default) | "compare" | "better-season"
 *   difficulty  — "easy" | "medium" (default) | "hard"   [mode=guess only]
 *   stat        — "PTS" (default) | "TRB" | "AST"        [mode=better-season only]
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const mode = searchParams.get('mode') ?? 'guess';
  const difficultyParam = searchParams.get('difficulty') ?? 'medium';
  const statParam = (searchParams.get('stat') ?? 'PTS').toUpperCase();

  try {
    if (mode === 'guess') {
      const validDifficulties: QuizDifficulty[] = ['easy', 'medium', 'hard'];
      const difficulty: QuizDifficulty = validDifficulties.includes(difficultyParam as QuizDifficulty)
        ? (difficultyParam as QuizDifficulty)
        : 'medium';

      const player = getPlayerForQuizByDifficulty(difficulty);
      if (!player) {
        return NextResponse.json({ error: 'No player data available' }, { status: 503 });
      }
      return NextResponse.json(player);
    }

    if (mode === 'better-season') {
      const validStats = ['PTS', 'TRB', 'AST'] as const;
      type BetterSeasonStat = (typeof validStats)[number];
      const stat: BetterSeasonStat = (validStats as readonly string[]).includes(statParam)
        ? (statParam as BetterSeasonStat)
        : 'PTS';

      const pair = getBetterSeasonPair(stat);
      return NextResponse.json(pair);
    }

    if (mode === 'compare') {
      const pair = getRandomPairForQuiz();
      return NextResponse.json(pair);
    }

    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  } catch (e) { return handleApiError(e, 'quiz'); }
}
