import { NextRequest, NextResponse } from 'next/server';
import {
  getVideo,
  createProcessingJob,
  getProcessingJob,
  updateProcessingJob,
  insertClip,
  addClipTag,
  listClips,
  updateVideoStatus,
} from '@/lib/film-db';

const MOCK_PLAY_TYPES = [
  'pick_and_roll',
  'isolation',
  'spot_up',
  'transition',
  'post_up',
  'handoff',
  'cut',
  'off_screen',
];

const MOCK_ACTIONS = [
  'drive',
  'pull_up_jumper',
  'catch_and_shoot',
  'layup',
  'dunk',
  'floater',
  'stepback',
  'fadeaway',
];

const MOCK_PLAYERS = [
  'LeBron James',
  'Stephen Curry',
  'Kevin Durant',
  'Jayson Tatum',
  'Luka Doncic',
  'Giannis Antetokounmpo',
  'Nikola Jokic',
  'Shai Gilgeous-Alexander',
];

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateMockClips(videoId: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const startTime = Math.round(i * 12 + Math.random() * 5);
    const endTime = startTime + 4 + Math.round(Math.random() * 6);
    const playType = pickRandom(MOCK_PLAY_TYPES);
    const player = pickRandom(MOCK_PLAYERS);

    const clipId = insertClip({
      video_id: videoId,
      title: `${player} - ${playType.replace(/_/g, ' ')}`,
      start_time: startTime,
      end_time: endTime,
      quarter: Math.ceil(Math.random() * 4),
      game_clock: `${Math.floor(Math.random() * 12)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
      shot_clock: Math.round(Math.random() * 24 * 10) / 10,
      play_type: playType,
      primary_action: pickRandom(MOCK_ACTIONS),
      primary_player: player,
      confidence: 0.7 + Math.random() * 0.3,
    });

    addClipTag(clipId, playType.replace(/_/g, ' '), 'action');
    addClipTag(clipId, player, 'player');
  }
}

export async function GET(request: NextRequest) {
  const jobIdParam = request.nextUrl.searchParams.get('jobId');

  if (!jobIdParam) {
    return NextResponse.json(
      { error: 'jobId query parameter is required' },
      { status: 400 },
    );
  }

  const jobId = Number(jobIdParam);
  if (!Number.isFinite(jobId) || jobId < 1) {
    return NextResponse.json(
      { error: 'Invalid jobId' },
      { status: 400 },
    );
  }

  try {
    const job = getProcessingJob(jobId);
    if (!job) {
      return NextResponse.json(
        { error: 'Processing job not found' },
        { status: 404 },
      );
    }

    return NextResponse.json(job);
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoId, mode } = body;

    if (videoId == null) {
      return NextResponse.json(
        { error: 'videoId is required' },
        { status: 400 },
      );
    }

    if (typeof videoId !== 'number') {
      return NextResponse.json(
        { error: 'videoId must be a number' },
        { status: 400 },
      );
    }

    if (mode !== 'quick' && mode !== 'deep') {
      return NextResponse.json(
        { error: "mode must be 'quick' or 'deep'" },
        { status: 400 },
      );
    }

    const video = getVideo(videoId);
    if (!video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 },
      );
    }

    const jobId = createProcessingJob(videoId, mode);

    // MVP: simulate processing synchronously with mock data
    updateProcessingJob(jobId, { status: 'running', progress: 0.1 });
    updateVideoStatus(videoId, 'processing');

    const { clips: existingClips } = listClips({ videoId, limit: 1 });
    if (existingClips.length === 0) {
      const clipCount = mode === 'quick' ? 8 : 20;
      generateMockClips(videoId, clipCount);
    }

    updateProcessingJob(jobId, {
      status: 'completed',
      progress: 1.0,
      result_summary: JSON.stringify({
        clips_generated: mode === 'quick' ? 8 : 20,
        mode,
      }),
    });
    updateVideoStatus(videoId, 'ready');

    return NextResponse.json(
      { jobId, status: 'queued' },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
