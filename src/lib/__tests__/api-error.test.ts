import { describe, it, expect } from 'vitest';
import { handleApiError } from '@/lib/api-error';

describe('handleApiError', () => {
  it('returns 500 status', () => {
    const response = handleApiError(new Error('test'), 'test-context');
    expect(response.status).toBe(500);
  });

  it('includes context in response body', async () => {
    const response = handleApiError(new Error('test'), 'my-route');
    const body = await response.json();
    expect(body.context).toBe('my-route');
    expect(body.error).toBe('Internal server error');
  });

  it('handles non-Error objects', () => {
    const response = handleApiError('string error', 'test');
    expect(response.status).toBe(500);
  });

  it('handles null/undefined errors', () => {
    const response = handleApiError(null, 'test');
    expect(response.status).toBe(500);
  });

  it('handles undefined errors', () => {
    const response = handleApiError(undefined, 'test');
    expect(response.status).toBe(500);
  });

  it('returns JSON content-type', () => {
    const response = handleApiError(new Error('test'), 'ctx');
    expect(response.headers.get('content-type')).toMatch(/application\/json/);
  });
});
