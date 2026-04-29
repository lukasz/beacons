/**
 * Thin wrapper over `supabase.auth`. Components and hooks that need
 * sign-in / session info should import from here, not from the
 * `supabase` client directly.
 */
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';

export interface AuthUser {
  id: string;
  name: string;
  avatarUrl: string;
}

export function toAuthUser(user: SupabaseUser): AuthUser {
  const meta = user.user_metadata || {};
  return {
    id: user.id,
    name: meta.full_name || meta.name || user.email || 'Anonymous',
    avatarUrl: meta.avatar_url || meta.picture || '',
  };
}

export const auth = {
  /** Resolve the current session (or `null` if signed out). */
  async getCurrentUser(): Promise<AuthUser | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user ? toAuthUser(session.user) : null;
  },

  /**
   * Subscribe to auth state changes. Returns an unsubscribe function
   * the caller is expected to invoke during cleanup.
   */
  onAuthChange(callback: (user: AuthUser | null) => void): () => void {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ? toAuthUser(session.user) : null);
    });
    return () => subscription.unsubscribe();
  },

  /** Kick off the Google OAuth flow, returning to the current URL. */
  signInWithGoogle(redirectTo?: string): Promise<void> {
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo ?? window.location.href },
    }).then(() => {});
  },

  /** End the current session. */
  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  },
};
