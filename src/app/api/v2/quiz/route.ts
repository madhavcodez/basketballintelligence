import { NextRequest, NextResponse } from 'next/server';
import {
  getPlayerForQuizByDifficulty,
  getRandomPairForQuiz,
  getBetterSeasonPair,
  getShotChartQuiz,
} from '@/lib/db';
import type { QuizDifficulty } from '@/lib/db';
import { handleApiError } from '@/lib/api-error';

type QuizMode = 'guess' | 'compare' | 'better-season' | 'shot-chart';

const VALID_MODES: ReadonlySet<string> = new Set<QuizMode>([
  'guess',
  'compare',
  'better-season',
  'shot-chart',
]);

const VALID_DIFFICULTIES: ReadonlySet<string> = new Set<QuizDifficulty>([
  'easy',
  'medium',
  'hard',
]);

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const mode = searchParams.get('mode') ?? 'guess';
    const difficulty = searchParams.get('difficulty') ?? 'medium';

    if (!VALID_MODES.has(mode)) {
      return NextResponse.json(
        { error: `Invalid mode "${mode}". Must be one of: guess, compare, better-season, shot-chart` },
        { status: 400 },
      );
    }

    if (!VALID_DIFFICULTIES.has(difficulty)) {
      return NextResponse.json(
        { error: `Invalid difficulty "${difficulty}". Must be one of: easy, medium, hard` },
        { status: 400 },
      );
    }

    switch (mode as QuizMode) {
      case 'guess': {
        const data = getPlayerForQuizByDifficulty(difficulty as QuizDifficulty);
        return NextResponse.json({ mode, difficulty, data });
      }
      case 'compare': {
        const data = getRandomPairForQuiz();
        return NextResponse.json({ mode, data });
      }
      case 'better-season': {
        const data = getBetterSeasonPair();
        return NextResponse.json({ mode, data });
      }
      case 'shot-chart': {
        const data = getShotChartQuiz();
        return NextResponse.json({ mode, data });
      }
      default: {
        return NextResponse.json(
          { error: `Unknown mode "${mode}"` },
          { status: 400 },
        );
      }
    }
  } catch (e) { return handleApiError(e, 'v2-quiz'); }
}
