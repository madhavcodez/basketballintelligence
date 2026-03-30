import { NextResponse } from 'next/server';

export function handleApiError(error: unknown, context: string): NextResponse {
  const message = error instanceof Error ? error.message : 'Unknown error';
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[API Error: ${context}]`, error);
  }
  return NextResponse.json(
    { error: 'Internal server error', context },
    { status: 500 }
  );
}
