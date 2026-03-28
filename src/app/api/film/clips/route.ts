import { NextRequest, NextResponse } from 'next/server';
import {
  listClips,
  searchClips,
  insertClip,
  addClipTag,
  type ClipFilters,
} from '@/lib/film-db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get('q');

  try {
    if (q) {
      const limit = Number(searchParams.get('limit')) || 20;
      const clips = searchClips(q, limit);
      return NextResponse.json({ clips, total: clips.length, filters: { q } });
    }

    const filters: ClipFilters = {
      player: searchParams.get('player') ?? undefined,
      playType: searchParams.get('playType') ?? undefined,
      action: searchParams.get('action') ?? undefined,
      tag: searchParams.get('tag') ?? undefined,
      videoId: searchParams.get('videoId')
        ? Number(searchParams.get('videoId'))
        : undefined,
      limit: Number(searchParams.get('limit')) || 20,
      offset: Number(searchParams.get('offset')) || 0,
    };

    const { clips, total } = listClips(filters);
    return NextResponse.json({ clips, total, filters });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoId, startTime, endTime, playType, primaryPlayer, tags } = body;

    if (videoId == null || startTime == null || endTime == null) {
      return NextResponse.json(
        { error: 'videoId, startTime, and endTime are required' },
        { status: 400 },
      );
    }

    if (typeof videoId !== 'number' || typeof startTime !== 'number' || typeof endTime !== 'number') {
      return NextResponse.json(
        { error: 'videoId, startTime, and endTime must be numbers' },
        { status: 400 },
      );
    }

    if (endTime <= startTime) {
      return NextResponse.json(
        { error: 'endTime must be greater than startTime' },
        { status: 400 },
      );
    }

    const clipId = insertClip({
      video_id: videoId,
      start_time: startTime,
      end_time: endTime,
      play_type: playType ?? null,
      primary_player: primaryPlayer ?? null,
    });

    if (Array.isArray(tags)) {
      for (const tag of tags) {
        if (typeof tag === 'string' && tag.trim().length > 0) {
          addClipTag(clipId, tag.trim(), 'custom');
        }
      }
    }

    return NextResponse.json({ id: clipId }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
