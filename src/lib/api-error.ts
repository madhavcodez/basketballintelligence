import { NextResponse } from 'next/server';

export function handleApiError(error: unknown, context: string): NextResponse {
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[API Error: ${context}]`, error);
  }
  const body =
    process.env.NODE_ENV === 'production'
      ? { error: 'Internal server error' }
      : { error: 'Internal server error', context };
  return NextResponse.json(body, { status: 500 });
}
