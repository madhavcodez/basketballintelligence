import { NextResponse } from 'next/server';
import { getPlayerClipCounts } from '@/lib/film-db';
import { getDb } from '@/lib/db';
import { handleApiError } from '@/lib/api-error';

export async function GET() {
  try {
    const filmPlayers = getPlayerClipCounts();

    const enriched = filmPlayers.map((fp) => {
      let stats: Record<string, unknown> | null = null;
      try {
        const db = getDb();
        const playerRow = db.prepare(`
          SELECT Pos as position, Height as height, Weight as weight,
                 Active as active, "From" as fromYear, "To" as toYear
          FROM players WHERE Player = ?
        `).get(fp.player) as Record<string, unknown> | undefined;

        const latestStats = db.prepare(`
          SELECT Season as season, Tm as team, PTS as ppg, TRB as rpg,
                 AST as apg, STL as spg, BLK as bpg
          FROM player_stats_pergame
          WHERE Player = ? ORDER BY Season DESC LIMIT 1
        `).get(fp.player) as Record<string, unknown> | undefined;

        if (playerRow) {
          stats = { ...playerRow, latestStats: latestStats ?? null };
        }
      } catch {
        // basketball.db may not be available
      }

      return {
        player: fp.player,
        clipCount: fp.count,
        stats,
      };
    });

    return NextResponse.json({ players: enriched });
  } catch (e) { return handleApiError(e, 'film-players'); }
}
