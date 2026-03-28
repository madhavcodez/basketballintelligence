import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;

  if (!/^[\w\-.]+\.jpg$/i.test(filename)) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }

  const filePath = path.join(process.cwd(), 'data', 'thumbnails', filename);
  if (!existsSync(filePath)) {
    return NextResponse.json({ error: 'Thumbnail not found' }, { status: 404 });
  }

  const buffer = readFileSync(filePath);
  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'image/jpeg',
      'Content-Length': String(buffer.byteLength),
      'Cache-Control': 'public, max-age=604800, immutable',
    },
  });
}
