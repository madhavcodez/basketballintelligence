import { NextResponse } from 'next/server';
import { getArchetypeQuiz } from '@/lib/db';

/**
 * GET /api/quiz/archetype
 *
 * Returns an anonymised statistical fingerprint for a real NBA season plus
 * four archetype options so the frontend can ask "what kind of player is this?"
 *
 * Archetypes (all possible values):
 *   Rim Protector | Floor General | Isolation Scorer | 3-and-D Wing |
 *   Paint Scorer  | Two-Way Star  | Playmaking Scorer | Efficient Scorer
 *
 * Response shape:
 * {
 *   season: number;          // e.g. 2024
 *   statLine: {
 *     pts: number; reb: number; ast: number; games: number;
 *     per: number; usgPct: number; tsPct: number; astPct: number;
 *     blkPct: number; stlPct: number; orbPct: number; threePAr: number;
 *   };
 *   options: string[];       // 4 archetype labels, shuffled
 *   correctAnswer: string;
 * }
 *
 */
export async function GET() {
  try {
    const quiz = getArchetypeQuiz();
    if (!quiz) {
      return NextResponse.json({ error: 'No archetype data available' }, { status: 503 });
    }
    return NextResponse.json(quiz);
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
