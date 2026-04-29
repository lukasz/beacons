import { useState, useEffect, useCallback } from 'react';
import { auth, type AuthUser } from '../services/auth';

// Re-export so existing imports of `AuthUser` from this hook keep working.
export type { AuthUser } from '../services/auth';

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auth.getCurrentUser().then((u) => {
      setUser(u);
      setLoading(false);
    });
    return auth.onAuthChange((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const signIn = useCallback(() => {
    void auth.signInWithGoogle();
  }, []);

  const signOut = useCallback(async () => {
    await auth.signOut();
    setUser(null);
  }, []);

  return { user, loading, signIn, signOut };
}
