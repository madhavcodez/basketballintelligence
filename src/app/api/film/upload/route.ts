import { NextRequest, NextResponse } from 'next/server';
import { insertVideo } from '@/lib/film-db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File exceeds 500 MB limit' },
        { status: 413 },
      );
    }

    const mimeType = file.type || '';
    if (!mimeType.startsWith('video/')) {
      return NextResponse.json(
        { error: 'Only video files are accepted' },
        { status: 415 },
      );
    }

    const originalName = file instanceof File ? file.name : 'video.mp4';
    const timestamp = Date.now();
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${timestamp}_${safeName}`;

    const clipsDir = path.join(process.cwd(), 'data', 'clips');
    await mkdir(clipsDir, { recursive: true });

    const filepath = path.join(clipsDir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    const videoId = insertVideo({
      title: originalName.replace(/\.[^.]+$/, ''),
      filename,
      filepath,
      file_size_bytes: file.size,
      source_type: 'upload',
    });

    return NextResponse.json(
      { videoId, status: 'pending' },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
