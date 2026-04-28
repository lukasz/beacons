/**
 * Single source of truth for browser-storage keys and access.
 *
 * Don't read/write `localStorage` or `sessionStorage` directly anywhere
 * else in the codebase — register a key here and use the helpers below.
 *
 * Each registered key declares whether it lives in `local` (persists
 * across tabs/sessions) or `session` (per-tab) storage.
 */

type StorageKind = 'local' | 'session';

interface StorageKeyMeta {
  kind: StorageKind;
  key: string;
}

export const STORAGE_KEYS = {
  /** UI theme — 'light' | 'dark'. */
  theme:           { kind: 'local',   key: 'beacons-theme' },
  /** Live cursors visibility — 'on' | 'off'. */
  cursors:         { kind: 'local',   key: 'beacons-cursors' },
  /** Linear personal API key (OAuth-derived). */
  linearApiKey:    { kind: 'local',   key: 'beacons-linear-key' },
  /** Last-selected team id on the dashboard's team tab. */
  teamTabSelected: { kind: 'local',   key: 'beacons-team-tab-selected' },
  /** Guest session info for public boards (per-tab so tabs don't leak). */
  guestUser:       { kind: 'session', key: 'beacons-guest' },
} as const satisfies Record<string, StorageKeyMeta>;

export type StorageKeyName = keyof typeof STORAGE_KEYS;

function storeFor(kind: StorageKind): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    // Some browsers throw in private mode; treat as unavailable.
    return null;
  }
}

export const storage = {
  /** Read a string value. Returns `null` if missing or storage is unavailable. */
  read(name: StorageKeyName): string | null {
    const meta = STORAGE_KEYS[name];
    return storeFor(meta.kind)?.getItem(meta.key) ?? null;
  },

  /** Write a string value. No-op if storage is unavailable. */
  write(name: StorageKeyName, value: string): void {
    const meta = STORAGE_KEYS[name];
    storeFor(meta.kind)?.setItem(meta.key, value);
  },

  /**
   * Read a JSON-encoded value. Returns `null` on missing keys or parse
   * errors (the latter logged via console.warn — bad JSON is rare and
   * usually indicates corruption worth knowing about).
   */
  readJson<T>(name: StorageKeyName): T | null {
    const raw = storage.read(name);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch (err) {
      console.warn(`[storage] failed to parse ${name}:`, err);
      return null;
    }
  },

  /** Write a JSON-encoded value. */
  writeJson<T>(name: StorageKeyName, value: T): void {
    storage.write(name, JSON.stringify(value));
  },

  /** Remove a value. No-op if storage is unavailable. */
  clear(name: StorageKeyName): void {
    const meta = STORAGE_KEYS[name];
    storeFor(meta.kind)?.removeItem(meta.key);
  },

  /** True if a value exists for the key. */
  has(name: StorageKeyName): boolean {
    return storage.read(name) !== null;
  },
};
