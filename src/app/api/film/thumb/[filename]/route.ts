import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

const THUMB_DIR = path.join(process.cwd(), 'data', 'thumbnails');

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;

  if (!/^[\w\-.]+\.jpg$/i.test(filename)) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }

  // Defense in depth: ensure the resolved path stays within the thumbnails dir.
  const filePath = path.resolve(THUMB_DIR, filename);
  if (!filePath.startsWith(THUMB_DIR + path.sep)) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }

  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch {
    return NextResponse.json({ error: 'Thumbnail not found' }, { status: 404 });
  }

  // Slice into a fresh ArrayBuffer so the Web Response constructor accepts it
  // cleanly under TS's strict BodyInit typing.
  const body = (buffer.buffer as ArrayBuffer).slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  );

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'image/jpeg',
      'Content-Length': String(buffer.byteLength),
      'Cache-Control': 'public, max-age=604800, immutable',
    },
  });
}
