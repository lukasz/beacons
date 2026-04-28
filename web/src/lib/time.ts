/**
 * Human-readable "time since" string. Falls back to a localised date
 * once the gap exceeds 30 days.
 *
 * The `now` parameter is for testability — callers in production can
 * omit it and get `Date.now()`.
 */
export function timeAgo(dateStr: string, now: number = Date.now()): string {
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
