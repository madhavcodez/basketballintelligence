import { describe, it, expect } from 'vitest';
import { config } from '@/lib/config';

describe('config', () => {
  it('has a db section with a path', () => {
    expect(config.db).toBeDefined();
    expect(typeof config.db.path).toBe('string');
    expect(config.db.path.length).toBeGreaterThan(0);
  });

  it('db path ends with basketball.db by default', () => {
    expect(config.db.path).toMatch(/basketball\.db$/);
  });

  it('has a gemini section with required fields', () => {
    expect(config.gemini).toBeDefined();
    expect(typeof config.gemini.model).toBe('string');
    expect(config.gemini.model.length).toBeGreaterThan(0);
    expect(typeof config.gemini.maxMessageLength).toBe('number');
    expect(config.gemini.maxMessageLength).toBeGreaterThan(0);
    expect(typeof config.gemini.maxOutputTokens).toBe('number');
    expect(config.gemini.maxOutputTokens).toBeGreaterThan(0);
    expect(typeof config.gemini.temperature).toBe('number');
  });

  it('has a cache section with numeric TTL values', () => {
    expect(config.cache).toBeDefined();
    expect(typeof config.cache.static).toBe('number');
    expect(typeof config.cache.player).toBe('number');
    expect(typeof config.cache.search).toBe('number');
    expect(typeof config.cache.none).toBe('number');
    expect(config.cache.none).toBe(0);
  });

  it('cache static TTL is greater than player TTL', () => {
    expect(config.cache.static).toBeGreaterThanOrEqual(config.cache.player);
  });

  it('gemini temperature is between 0 and 1', () => {
    expect(config.gemini.temperature).toBeGreaterThanOrEqual(0);
    expect(config.gemini.temperature).toBeLessThanOrEqual(1);
  });
});
