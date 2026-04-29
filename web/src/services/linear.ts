/**
 * `linear` service — wraps the GraphQL transport in `linearClient.ts`
 * with auth-aware behaviour: pulls the API key from storage, runs the
 * caller's function, and translates 401-shaped errors into a typed
 * `LinearAuthError` while wiping the stored key.
 *
 * Server-side OAuth status check (`/api/linear/status`) lives here too
 * so components don't reach for `fetch('/api/...')` directly.
 */
import { http } from './http';
import { storage } from '../lib/storage';

export class LinearAuthError extends Error {
  constructor(message = 'Linear session expired. Please reconnect.') {
    super(message);
    this.name = 'LinearAuthError';
  }
}

/** Recognise the various ways our transport surfaces an auth failure. */
export function isLinearAuthError(err: unknown): boolean {
  if (err instanceof LinearAuthError) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /401|AUTHENTICATION|not authenticated/.test(msg);
}

export const linear = {
  /**
   * Run `fn` with the user's stored API key. Throws `LinearAuthError`
   * (and clears the stored key) if the key is missing or rejected by
   * Linear; rethrows any other error untouched.
   */
  async withKey<T>(fn: (apiKey: string) => Promise<T>): Promise<T> {
    const key = storage.read('linearApiKey');
    if (!key) throw new LinearAuthError('Connect Linear first.');
    try {
      return await fn(key);
    } catch (err) {
      if (isLinearAuthError(err)) {
        storage.clear('linearApiKey');
        throw new LinearAuthError();
      }
      throw err;
    }
  },

  /** Whether the server has Linear OAuth credentials configured. */
  async status(): Promise<{ oauthEnabled: boolean }> {
    try {
      return await http.get<{ oauthEnabled: boolean }>('/api/linear/status');
    } catch {
      return { oauthEnabled: false };
    }
  },
};
