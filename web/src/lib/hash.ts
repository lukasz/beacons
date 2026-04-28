/**
 * Deterministic 32-bit hash of a string. Used for stable colour pickers
 * and similar — not security.
 */
export function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}
