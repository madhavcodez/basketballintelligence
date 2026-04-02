import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { classifyZone } from '@/lib/zone-engine';
import type { ZoneName } from '@/lib/shot-constants';
import { handleApiError } from '@/lib/api-error';
import { jsonWithCache } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

// ── Types ─────────────────────────────────────────────────────────

interface ShotRow {
  readonly x: number;
  readonly y: number;
  readonly made: number;
  readonly season: string;
}

interface SeasonZoneDistribution {
  readonly season: string;
  readonly totalShots: number;
  readonly zones: Record<string, number>;
}

// ── Constants ─────────────────────────────────────────────────────

const MIN_SEASON_SHOTS = 50;

// ── Handler ───────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const playerName = decodeURIComponent(name);

  try {
    const db = getDb();

    // Batch query: get all shots for this player at once, ordered by season
    const rows = db
      .prepare(
        `SELECT CAST(LOC_X AS REAL) * 10 as x, (CAST(LOC_Y AS REAL) - 5.25) * 10 as y, SHOT_MADE_FLAG as made, season
         FROM shots
         WHERE PLAYER_NAME = ?
         ORDER BY season ASC`
      )
      .all(playerName) as ShotRow[];

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'No shots found for this player' },
        { status: 404 }
      );
    }

    // Group shots by season in JS (single pass)
    const seasonMap = new Map<string, ShotRow[]>();
    for (const row of rows) {
      const existing = seasonMap.get(row.season);
      if (existing) {
        existing.push(row);
      } else {
        seasonMap.set(row.season, [row]);
      }
    }

    // Compute zone distribution per season
    const seasons: SeasonZoneDistribution[] = [];

    for (const [season, shots] of seasonMap) {
      if (shots.length < MIN_SEASON_SHOTS) {
        continue;
      }

      // Count attempts per zone
      const zoneCounts = new Map<ZoneName, number>();
      for (const shot of shots) {
        const zone = classifyZone(shot.x, shot.y);
        zoneCounts.set(zone, (zoneCounts.get(zone) ?? 0) + 1);
      }

      // Convert to attempt percentages (0-1)
      const totalShots = shots.length;
      const zones: Record<string, number> = {};
      for (const [zone, count] of zoneCounts) {
        zones[zone] = count / totalShots;
      }

      seasons.push({
        season,
        totalShots,
        zones,
      });
    }

    // Seasons are already sorted chronologically from the SQL ORDER BY

    return jsonWithCache({
      player: playerName,
      seasons,
    }, 120);
  } catch (e) { return handleApiError(e, 'zones-trend'); }
}
