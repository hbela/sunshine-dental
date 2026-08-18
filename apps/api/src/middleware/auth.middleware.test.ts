import { describe, it, expect, afterEach } from 'vitest';
import { isValidApiKey } from './auth.middleware.js';

const ORIGINAL = process.env.FASTIFY_API_KEY;

afterEach(() => {
  if (ORIGINAL === undefined) {
    delete process.env.FASTIFY_API_KEY;
  } else {
    process.env.FASTIFY_API_KEY = ORIGINAL;
  }
});

describe('isValidApiKey', () => {
  it('rejects everything when FASTIFY_API_KEY is unset', () => {
    delete process.env.FASTIFY_API_KEY;
    expect(isValidApiKey(undefined)).toBe(false);
    expect(isValidApiKey('')).toBe(false);
    expect(isValidApiKey('anything')).toBe(false);
  });

  it('rejects an empty key against an empty env value', () => {
    process.env.FASTIFY_API_KEY = '';
    expect(isValidApiKey('')).toBe(false);
    expect(isValidApiKey(undefined)).toBe(false);
  });

  it('accepts the exact configured key', () => {
    process.env.FASTIFY_API_KEY = 'test-key-0123456789abcdef';
    expect(isValidApiKey('test-key-0123456789abcdef')).toBe(true);
  });

  it('rejects a wrong key of the same length', () => {
    process.env.FASTIFY_API_KEY = 'test-key-0123456789abcdef';
    expect(isValidApiKey('test-key-0123456789abcdXX')).toBe(false);
  });

  it('rejects keys of a different length', () => {
    process.env.FASTIFY_API_KEY = 'test-key-0123456789abcdef';
    expect(isValidApiKey('short')).toBe(false);
    expect(isValidApiKey('test-key-0123456789abcdef-longer')).toBe(false);
  });
});
