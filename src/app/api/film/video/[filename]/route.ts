import { NextRequest, NextResponse } from 'next/server';
import { createReadStream, statSync, existsSync } from 'fs';
import path from 'path';
import { Readable } from 'stream';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;

  // Sanitize: only allow alphanumeric, dashes, underscores, dots
  if (!/^[\w\-.]+\.mp4$/i.test(filename)) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }

  // Resolve to data directory — check both data/ and data/clips/
  const dataDir = path.join(process.cwd(), 'data');
  let filePath = path.join(dataDir, filename);
  if (!existsSync(filePath)) {
    filePath = path.join(dataDir, 'clips', filename);
  }
  if (!existsSync(filePath)) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  }

  const stat = statSync(filePath);
  const fileSize = stat.size;
  const range = request.headers.get('range');

  // Support range requests for video seeking
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + 5 * 1024 * 1024, fileSize - 1);
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
