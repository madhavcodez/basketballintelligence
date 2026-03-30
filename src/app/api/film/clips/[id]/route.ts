import { NextRequest, NextResponse } from 'next/server';
import {
  getClip,
  getVideo,
  getClipTags,
  getClipAnnotations,
  getRelatedClips,
  updateClip,
} from '@/lib/film-db';
import { getDb } from '@/lib/db';
import { handleApiError } from '@/lib/api-error';

function getPlayerContext(playerName: string | null): Record<string, unknown> | null {
  if (!playerName) return null;
  try {
    const db = getDb();
    const player = db.prepare(`
      SELECT rowid as id, Player as name, Pos as position, Height as height,
             Weight as weight, College as college, BirthDate as birthDate,
             HOF as hof, Active as active, "From" as fromYear, "To" as toYear
      FROM players WHERE Player = ?
    `).get(playerName) as Record<string, unknown> | undefined;
    if (!player) return null;

    const latestStats = db.prepare(`
      SELECT Season as season, Tm as team, Age as age, G as games,
             PTS as ppg, TRB as rpg, AST as apg, STL as spg, BLK as bpg,
             "FG%" as fgPct, "3P%" as threePct, "FT%" as ftPct
      FROM player_stats_pergame
      WHERE Player = ? ORDER BY Season DESC LIMIT 1
    `).get(playerName) as Record<string, unknown> | undefined;

    return { ...player, latestStats: latestStats ?? null };
  } catch {
    return null;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const clipId = Number(id);

  if (!Number.isFinite(clipId) || clipId < 1) {
    return NextResponse.json({ error: 'Invalid clip ID' }, { status: 400 });
  }

  try {
    const clip = getClip(clipId);
    if (!clip) {
      return NextResponse.json({ error: 'Clip not found' }, { status: 404 });
    }

    const video = getVideo(clip.video_id);
    const tags = getClipTags(clipId);
    const annotations = getClipAnnotations(clipId);
    const relatedClips = getRelatedClips(clipId);
    const playerContext = getPlayerContext(clip.primary_player);
    const defenderContext = getPlayerContext(clip.defender);

    return NextResponse.json({
      clip,
      video,
      tags,
      annotations,
      relatedClips,
      playerContext,
      defenderContext,
    });
  } catch (e) { return handleApiError(e, 'film-clip-detail'); }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const clipId = Number(id);

  if (!Number.isFinite(clipId) || clipId < 1) {
    return NextResponse.json({ error: 'Invalid clip ID' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const updated = updateClip(clipId, {
      title: body.title,
      play_type: body.play_type,
      primary_action: body.primary_action,
      shot_result: body.shot_result,
      primary_player: body.primary_player,
      secondary_player: body.secondary_player,
      defender: body.defender,
      reviewed: body.reviewed,
    });

    if (!updated) {
      return NextResponse.json({ error: 'Clip not found or no changes' }, { status: 404 });
    }

    const clip = getClip(clipId);
    return NextResponse.json({ clip });
  } catch (e) { return handleApiError(e, 'film-clip-patch'); }
}
