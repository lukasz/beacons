import { describe, it, expect, vi, beforeEach } from 'vitest';
import { linear, LinearAuthError, isLinearAuthError } from './linear';
import { storage } from '../lib/storage';

const fetchSpy = vi.fn();
vi.stubGlobal('fetch', fetchSpy);

beforeEach(() => {
  fetchSpy.mockReset();
  storage.clear('linearApiKey');
});

describe('isLinearAuthError', () => {
  it.each([
    [new Error('401 Unauthorized'), true],
    [new Error('AUTHENTICATION_FAILED'), true],
    [new Error('not authenticated'), true],
    [new LinearAuthError(), true],
    [new Error('rate limit'), false],
    ['plain string with 401', true],
  ])('isLinearAuthError(%s) → %s', (input, expected) => {
    expect(isLinearAuthError(input)).toBe(expected);
  });
});

describe('linear.withKey', () => {
  it('throws LinearAuthError when no key is stored', async () => {
    await expect(linear.withKey(async () => 'ok')).rejects.toBeInstanceOf(LinearAuthError);
  });

  it('runs the callback with the stored key on success', async () => {
    storage.write('linearApiKey', 'lin_xyz');
    const fn = vi.fn().mockResolvedValue('result');
    expect(await linear.withKey(fn)).toBe('result');
    expect(fn).toHaveBeenCalledWith('lin_xyz');
  });

  it('clears the stored key and rethrows LinearAuthError on 401', async () => {
    storage.write('linearApiKey', 'lin_bad');
    await expect(
      linear.withKey(async () => { throw new Error('401: not authenticated'); }),
    ).rejects.toBeInstanceOf(LinearAuthError);
    expect(storage.read('linearApiKey')).toBeNull();
  });

  it('rethrows non-auth errors untouched and keeps the key', async () => {
    storage.write('linearApiKey', 'lin_ok');
    await expect(
      linear.withKey(async () => { throw new Error('rate limit'); }),
    ).rejects.toThrow('rate limit');
    expect(storage.read('linearApiKey')).toBe('lin_ok');
  });
});

describe('linear.status', () => {
  it('returns the parsed JSON when /api/linear/status is healthy', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ oauthEnabled: true }), { status: 200 }));
    expect(await linear.status()).toEqual({ oauthEnabled: true });
  });

  it('returns oauthEnabled=false when the endpoint errors', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('err', { status: 500 }));
    expect(await linear.status()).toEqual({ oauthEnabled: false });
  });
});
