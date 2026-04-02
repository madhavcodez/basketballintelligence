import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { handleApiError } from '@/lib/api-error';
import { jsonWithCache } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

// Returns a random interesting zone stat for the "Zone of the Day" feature
export async function GET() {
  try {
    const db = getDb();

    const seasonRow = db.prepare('SELECT MAX(season) as s FROM shots').get() as { s: string } | undefined;
    const season = seasonRow?.s;
    if (!season) {
      return NextResponse.json({ error: 'No data' }, { status: 404 });
    }

    // Get a collection of extreme stats from different zones
    const spotlights = [
      // Best restricted area shooter (high volume)
      db.prepare(`
        SELECT PLAYER_NAME as player,
               ROUND(CAST(SUM(CAST(SHOT_MADE_FLAG AS INTEGER)) AS FLOAT) / COUNT(*) * 100, 1) as fgPct,
               COUNT(*) as attempts
        FROM shots
        WHERE SHOT_ZONE_BASIC = 'Restricted Area' AND season = ?
        GROUP BY PLAYER_NAME HAVING COUNT(*) >= 200
        ORDER BY fgPct DESC LIMIT 1
      `).get(season) as { player: string; fgPct: number; attempts: number } | undefined,

      // Best 3-point shooter (volume)
      db.prepare(`
        SELECT PLAYER_NAME as player,
               ROUND(CAST(SUM(CAST(SHOT_MADE_FLAG AS INTEGER)) AS FLOAT) / COUNT(*) * 100, 1) as fgPct,
               COUNT(*) as attempts
        FROM shots
        WHERE SHOT_ZONE_BASIC = 'Above the Break 3' AND season = ?
        GROUP BY PLAYER_NAME HAVING COUNT(*) >= 200
        ORDER BY fgPct DESC LIMIT 1
      `).get(season) as { player: string; fgPct: number; attempts: number } | undefined,

      // Most mid-range attempts
      db.prepare(`
        SELECT PLAYER_NAME as player,
               ROUND(CAST(SUM(CAST(SHOT_MADE_FLAG AS INTEGER)) AS FLOAT) / COUNT(*) * 100, 1) as fgPct,
               COUNT(*) as attempts
        FROM shots
        WHERE SHOT_ZONE_BASIC = 'Mid-Range' AND season = ?
        GROUP BY PLAYER_NAME HAVING COUNT(*) >= 100
        ORDER BY attempts DESC LIMIT 1
      `).get(season) as { player: string; fgPct: number; attempts: number } | undefined,

      // Best corner 3 shooter
      db.prepare(`
        SELECT PLAYER_NAME as player,
               ROUND(CAST(SUM(CAST(SHOT_MADE_FLAG AS INTEGER)) AS FLOAT) / COUNT(*) * 100, 1) as fgPct,
               COUNT(*) as attempts
        FROM shots
        WHERE (SHOT_ZONE_BASIC = 'Left Corner 3' OR SHOT_ZONE_BASIC = 'Right Corner 3') AND season = ?
        GROUP BY PLAYER_NAME HAVING COUNT(*) >= 80
        ORDER BY fgPct DESC LIMIT 1
      `).get(season) as { player: string; fgPct: number; attempts: number } | undefined,
    ];

    const templates = [
      (s: { player: string; fgPct: number; attempts: number }) =>
        ({ text: `${s.player} shoots ${s.fgPct}% at the rim on ${s.attempts} attempts`, zone: 'Restricted Area', player: s.player }),
      (s: { player: string; fgPct: number; attempts: number }) =>
        ({ text: `${s.player} leads with ${s.fgPct}% from above the break on ${s.attempts} 3s`, zone: 'Above the Break 3', player: s.player }),
      (s: { player: string; fgPct: number; attempts: number }) =>
        ({ text: `${s.player} has the most mid-range shots: ${s.attempts} at ${s.fgPct}%`, zone: 'Mid-Range', player: s.player }),
      (s: { player: string; fgPct: number; attempts: number }) =>
        ({ text: `${s.player} is the corner 3 king at ${s.fgPct}% on ${s.attempts} attempts`, zone: 'Corner 3', player: s.player }),
    ];

    // Pick a random one that has data
    const available = spotlights
      .map((s, i) => s ? { stat: s, template: templates[i] } : null)
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (available.length === 0) {
      return NextResponse.json({ spotlight: null });
    }

    const pick = available[Math.floor(Math.random() * available.length)];
    const spotlight = pick.template(pick.stat);

    // Look up personId for headshot
    const pRow = db.prepare('SELECT person_id FROM players WHERE Player = ?').get(spotlight.player) as { person_id: string | number } | undefined;

    return jsonWithCache({ season, spotlight: { ...spotlight, personId: pRow?.person_id ?? null } }, 120);
  } catch (e) { return handleApiError(e, 'zones-spotlight'); }
}
