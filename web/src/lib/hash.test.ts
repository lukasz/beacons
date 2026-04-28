import { describe, it, expect } from 'vitest';
import { hashCode } from './hash';

describe('hashCode', () => {
  it('is deterministic for the same input', () => {
    expect(hashCode('beacons')).toBe(hashCode('beacons'));
  });

  it('returns 0 for an empty string', () => {
    expect(hashCode('')).toBe(0);
  });

  it('produces a 32-bit signed integer', () => {
    const h = hashCode('a fairly long input string for the hash function');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(-(2 ** 31));
    expect(h).toBeLessThan(2 ** 31);
  });

  it('produces different hashes for different inputs', () => {
    expect(hashCode('foo')).not.toBe(hashCode('bar'));
    expect(hashCode('foo')).not.toBe(hashCode('foO'));
  });
});
