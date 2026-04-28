import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storage, STORAGE_KEYS } from './storage';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('storage.read/write/clear', () => {
  it('round-trips a string value via localStorage for local keys', () => {
    storage.write('theme', 'dark');
    expect(storage.read('theme')).toBe('dark');
    expect(localStorage.getItem(STORAGE_KEYS.theme.key)).toBe('dark');
    storage.clear('theme');
    expect(storage.read('theme')).toBeNull();
  });

  it('round-trips via sessionStorage for session keys', () => {
    storage.write('guestUser', 'raw');
    expect(storage.read('guestUser')).toBe('raw');
    expect(sessionStorage.getItem(STORAGE_KEYS.guestUser.key)).toBe('raw');
    expect(localStorage.getItem(STORAGE_KEYS.guestUser.key)).toBeNull();
  });

  it('returns null for missing keys', () => {
    expect(storage.read('linearApiKey')).toBeNull();
  });

  it('has() reflects presence', () => {
    expect(storage.has('cursors')).toBe(false);
    storage.write('cursors', 'on');
    expect(storage.has('cursors')).toBe(true);
  });
});

describe('storage.readJson/writeJson', () => {
  it('round-trips an object', () => {
    storage.writeJson('guestUser', { id: 'g1', name: 'Ana' });
    expect(storage.readJson<{ id: string; name: string }>('guestUser')).toEqual({
      id: 'g1',
      name: 'Ana',
    });
  });

  it('returns null and warns on bad JSON', () => {
    sessionStorage.setItem(STORAGE_KEYS.guestUser.key, '{not-json}');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(storage.readJson('guestUser')).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('returns null when the key is missing', () => {
    expect(storage.readJson('guestUser')).toBeNull();
  });
});
