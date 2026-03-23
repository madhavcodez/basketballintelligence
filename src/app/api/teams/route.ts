import { NextResponse } from 'next/server';
import { getTeams } from '@/lib/db';

export async function GET() {
  try {
    const teams = getTeams();
    return NextResponse.json(teams);
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
