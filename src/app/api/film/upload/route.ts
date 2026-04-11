import { NextRequest, NextResponse } from 'next/server';
import { insertVideo } from '@/lib/film-db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { handleApiError } from '@/lib/api-error';

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
const ALLOWED_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.mkv', '.avi', '.m4v']);
const ALLOWED_MIME_PREFIXES = ['video/'];

// Magic-byte signatures for the formats we accept. Reading the first 16 bytes
// of the upload and matching against these prevents an attacker from spoofing
// the Content-Type header. We accept any MP4-family file (ftyp at offset 4)
// or Matroska/WebM (EBML 0x1A45DFA3 at offset 0).
function looksLikeVideo(buf: Buffer): boolean {
  if (buf.length < 16) return false;
  // ISO base media (mp4, mov, m4v): bytes 4..7 = "ftyp"
  if (
    buf[4] === 0x66 &&
    buf[5] === 0x74 &&
    buf[6] === 0x79 &&
    buf[7] === 0x70
  ) return true;
  // Matroska / WebM: starts with 1A 45 DF A3
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return true;
  // RIFF AVI: "RIFF" .... "AVI "
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x41 && buf[9] === 0x56 && buf[10] === 0x49 && buf[11] === 0x20
  ) return true;
  return false;
}

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
    if (!ALLOWED_MIME_PREFIXES.some((p) => mimeType.startsWith(p))) {
      return NextResponse.json(
        { error: 'Only video files are accepted' },
        { status: 415 },
      );
    }

    const originalName = file instanceof File ? file.name : 'video.mp4';
    const ext = path.extname(originalName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: 'Unsupported video format' },
        { status: 415 },
      );
    }

    const timestamp = Date.now();
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${timestamp}_${safeName}`;

    const clipsDir = path.join(process.cwd(), 'data', 'clips');
    await mkdir(clipsDir, { recursive: true });

    // path.basename guarantees no traversal even though safeName already
    // strips slashes — defense in depth.
    const filepath = path.join(clipsDir, path.basename(filename));
    const buffer = Buffer.from(await file.arrayBuffer());

    // Magic-byte verification: header must match a known video format.
    if (!looksLikeVideo(buffer)) {
      return NextResponse.json(
        { error: 'File is not a recognized video format' },
        { status: 415 },
      );
    }

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
  } catch (e) { return handleApiError(e, 'film-upload'); }
}
