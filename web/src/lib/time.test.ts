import { describe, it, expect } from 'vitest';
import { timeAgo } from './time';

const NOW = new Date('2026-04-17T12:00:00Z').getTime();

function ago(ms: number): string {
  return new Date(NOW - ms).toISOString();
}

describe('timeAgo', () => {
  it('returns "just now" for less than a minute', () => {
    expect(timeAgo(ago(30_000), NOW)).toBe('just now');
  });

  it('returns minutes for the first hour', () => {
    expect(timeAgo(ago(5 * 60_000), NOW)).toBe('5m ago');
    expect(timeAgo(ago(59 * 60_000), NOW)).toBe('59m ago');
  });

  it('returns hours up to 24', () => {
    expect(timeAgo(ago(2 * 3600_000), NOW)).toBe('2h ago');
    expect(timeAgo(ago(23 * 3600_000), NOW)).toBe('23h ago');
  });

  it('returns days up to 30', () => {
    expect(timeAgo(ago(3 * 86400_000), NOW)).toBe('3d ago');
    expect(timeAgo(ago(29 * 86400_000), NOW)).toBe('29d ago');
  });

  it('falls back to a localised date past 30 days', () => {
    const out = timeAgo(ago(60 * 86400_000), NOW);
    expect(out).not.toMatch(/ago$/);
    // Sanity: the returned string parses back to a date.
    expect(Number.isNaN(new Date(out).getTime())).toBe(false);
  });
});
