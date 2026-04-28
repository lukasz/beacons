/**
 * Vote-result rank labels. Index is the rank (1-based); index 0 is the
 * empty string so callers can use `RANK_MEDALS[rank]` directly.
 */
export const RANK_MEDALS: readonly string[] = [
  '',
  '\u{1F947}', // 🥇
  '\u{1F948}', // 🥈
  '\u{1F949}', // 🥉
];

/**
 * "1st", "2nd", "3rd", "11th"… — English ordinal suffix.
 */
export function ordinal(n: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}
