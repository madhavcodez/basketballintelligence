import { NextRequest, NextResponse } from 'next/server';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';

const DEFAULT_RANGE_CHUNK = 5 * 1024 * 1024; // 5 MiB
const DATA_DIR = path.join(process.cwd(), 'data');
const CLIPS_DIR = path.join(DATA_DIR, 'clips');

async function resolveVideoPath(filename: string): Promise<string | null> {
  // Try data/ then data/clips/. After resolving, verify the result is still
  // inside one of those directories — defense against any path-traversal
  // payload that might slip past the regex.
  for (const root of [DATA_DIR, CLIPS_DIR]) {
    const candidate = path.resolve(root, filename);
    if (!candidate.startsWith(root + path.sep)) continue;
    try {
      const s = await stat(candidate);
      if (s.isFile()) return candidate;
    } catch {
      // not present in this root — try the next
    }
  }
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;

  // Sanitize: only allow alphanumeric, dashes, underscores, dots; require .mp4
  if (!/^[\w\-.]+\.mp4$/i.test(filename)) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }

  const filePath = await resolveVideoPath(filename);
  if (!filePath) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  }

  const fileSize = (await stat(filePath)).size;
  const range = request.headers.get('range');

  // Support range requests for video seeking
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!match) {
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${fileSize}` },
      });
    }

    const startStr = match[1];
    const endStr = match[2];

    let start: number;
    let end: number;

    if (startStr === '' && endStr !== '') {
      // Suffix range: bytes=-500 → last 500 bytes
      const suffix = parseInt(endStr, 10);
      if (!Number.isFinite(suffix) || suffix <= 0) {
        return new Response(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${fileSize}` },
        });
      }
      start = Math.max(0, fileSize - suffix);
      end = fileSize - 1;
    } else {
      start = parseInt(startStr, 10);
      end = endStr === ''
        ? Math.min(start + DEFAULT_RANGE_CHUNK, fileSize - 1)
        : parseInt(endStr, 10);
    }

    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      start >= fileSize ||
      end < start
    ) {
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${fileSize}` },
      });
    }
    if (end >= fileSize) end = fileSize - 1;

    const chunkSize = end - start + 1;
    const stream = createReadStream(filePath, { start, end });
    const webStream = Readable.toWeb(stream) as ReadableStream;

    return new Response(webStream, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(chunkSize),
        'Content-Type': 'video/mp4',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }

  // Full file response
  const stream = createReadStream(filePath);
  const webStream = Readable.toWeb(stream) as ReadableStream;

  return new Response(webStream, {
    status: 200,
    headers: {
      'Content-Length': String(fileSize),
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
