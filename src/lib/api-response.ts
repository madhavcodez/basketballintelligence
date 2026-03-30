import { NextResponse } from 'next/server';

export function jsonWithCache(data: unknown, maxAge = 300): NextResponse {
  const response = NextResponse.json(data);
  if (maxAge > 0) {
    response.headers.set('Cache-Control', `public, s-maxage=${maxAge}, stale-while-revalidate=600`);
  }
  return response;
}
