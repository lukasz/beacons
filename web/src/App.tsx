import { useState, useCallback, useEffect } from 'react';
import { BoardContext, useBoardReducer, useBoardMessageHandler } from './hooks/useBoard';
import { useSync } from './hooks/useSync';
import { useAuth } from './hooks/useAuth';
import SignIn from './components/SignIn';
import GuestJoin from './components/GuestJoin';
import Dashboard from './components/Dashboard';
import Board from './components/Board';

// Initialize theme from localStorage before first render
(() => {
  const stored = localStorage.getItem('beacons-theme');
  document.documentElement.setAttribute('data-theme', stored === 'light' ? 'light' : 'dark');
})();

// ---- URL helpers ----

type NavState =
  | { view: 'dashboard'; tab?: string }
  | { view: 'board'; roomId: string; template?: boolean };

function parseLocation(): NavState {
  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);

  const boardMatch = path.match(/^\/board\/([^/]+)/);
  if (boardMatch) {
    return { view: 'board', roomId: boardMatch[1], template: params.get('mode') === 'template' || undefined };
  }

  // Legacy: bare /<roomId>
  const bare = path.slice(1);
  if (bare && /^[a-zA-Z0-9_-]{4,}$/.test(bare) && !['boards', 'templates', 'actions', 'teams'].includes(bare)) {
    return { view: 'board', roomId: bare };
  }

  const tab = params.get('tab');
  return { view: 'dashboard', tab: tab || undefined };
}

function navUrl(s: NavState): string {
  if (s.view === 'board') {
    const base = `/board/${s.roomId}`;
    return s.template ? `${base}?mode=template` : base;
  }
  if (s.tab && s.tab !== 'boards') return `/?tab=${s.tab}`;
  return '/';
}

export default function App() {
  const { user, loading, signIn, signOut } = useAuth();

  // Guest state for public boards
  const [guestUser, setGuestUser] = useState<{ id: string; name: string } | null>(() => {
    const stored = sessionStorage.getItem('beacons-guest');
    return stored ? JSON.parse(stored) : null;
  });
  const [boardAccessMode, setBoardAccessMode] = useState<string | null>(null);

  // Pick up Linear OAuth token from URL fragment
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('linear_token=')) {
      const token = new URLSearchParams(hash.slice(1)).get('linear_token');
      if (token) {
        localStorage.setItem('beacons-linear-key', token);
      }
      // Clean up the hash
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  // Parse initial state from URL
  const [navState, setNavState] = useState<NavState>(parseLocation);
  const [dashKey, setDashKey] = useState(0);

  const joined = navState.view === 'board';
  const roomId = navState.view === 'board' ? navState.roomId : null;
  const isTemplateMode = navState.view === 'board' && !!navState.template;
  const dashTab = navState.view === 'dashboard' ? navState.tab : undefined;

  const [state, dispatch] = useBoardReducer();
  const baseHandleMessage = useBoardMessageHandler(dispatch);
  const handleMessage = useCallback((type: string, payload: unknown) => {
    if (type === 'reaction') {
      const fn = (window as unknown as Record<string, unknown>).__triggerReactionRain;
      if (typeof fn === 'function') {
        (fn as (emoji: string) => void)((payload as { emoji: string }).emoji);
      }
      return;
    }
    if (type === 'cursor_move') {
      const fn = (window as unknown as Record<string, unknown>).__handleCursorMove;
      if (typeof fn === 'function') {
        (fn as (data: unknown) => void)(payload);
      }
      return;
    }
    baseHandleMessage(type, payload);
  }, [baseHandleMessage]);

  // Active user: authenticated user or guest
  const activeUser = user || guestUser;
  const isGuest = !user && !!guestUser;
  const userId = activeUser?.id || '';
  const userName = activeUser?.name || '';
  const { send } = useSync(joined && !!activeUser ? roomId : null, userId, userName, handleMessage);

  // Check board access mode when unauthenticated user lands on a board URL
  useEffect(() => {
    if (!loading && !user && roomId) {
      fetch(`/api/rooms/access/${roomId}`)
        .then((r) => r.json())
        .then((data) => setBoardAccessMode(data.accessMode || 'org'))
        .catch(() => setBoardAccessMode('org'));
    } else {
      setBoardAccessMode(null);
    }
  }, [loading, user, roomId]);

  const handleGuestJoin = useCallback((name: string) => {
    const guest = {
      id: `guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
    };
    sessionStorage.setItem('beacons-guest', JSON.stringify(guest));
    setGuestUser(guest);
  }, []);

  // ---- Navigation functions (push to history) ----

  const navigate = useCallback((s: NavState, replace = false) => {
    const url = navUrl(s);
    if (replace) {
      window.history.replaceState(s, '', url);
    } else {
      window.history.pushState(s, '', url);
    }
    setNavState(s);
  }, []);

  const handleCreate = useCallback(async () => {
    const res = await fetch('/api/rooms', { method: 'POST' });
    const data = await res.json();
    navigate({ view: 'board', roomId: data.id });
  }, [navigate]);

  const handleCreateTemplate = useCallback(async () => {
    try {
      const res = await fetch('/api/rooms/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionName: '',
          teamName: '',
          beatGoal: '',
          isTemplate: true,
          sections: [
            { title: 'What went well', colorIdx: 3 },
            { title: 'What could improve', colorIdx: 0 },
            { title: 'Action items', colorIdx: 5 },
          ],
          userId: userId,
          userName: userName,
        }),
      });
      const data = await res.json();
      navigate({ view: 'board', roomId: data.id, template: true });
    } catch (err) {
      console.error('Failed to create template:', err);
    }
  }, [userId, userName, navigate]);

  const handleEditTemplate = useCallback((id: string) => {
    navigate({ view: 'board', roomId: id, template: true });
  }, [navigate]);

  const handleUseTemplate = useCallback(async (templateId: string) => {
    try {
      const res = await fetch(`/api/rooms/clone/${templateId}`, { method: 'POST' });
      if (!res.ok) throw new Error('Clone failed');
      const data = await res.json();
      navigate({ view: 'board', roomId: data.id });
    } catch (err) {
      console.error('Failed to create board from template:', err);
    }
  }, [navigate]);

  // Keep legacy handleCreateFromTemplate for Linear cycle boards
  const handleCreateFromTemplate = useCallback(async (sections: { title: string; colorIdx: number }[], extra?: { sessionName?: string; teamName?: string; teamId?: string; cycleStats?: unknown }) => {
    try {
      const res = await fetch('/api/rooms/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionName: extra?.sessionName || '',
          teamName: extra?.teamName || '',
          teamId: extra?.teamId || '',
          beatGoal: '',
          sections,
          cycleStats: extra?.cycleStats,
          userId: userId,
          userName: userName,
        }),
      });
      const data = await res.json();
      navigate({ view: 'board', roomId: data.id });
    } catch (err) {
      console.error('Failed to create board from template:', err);
    }
  }, [userId, userName, navigate]);

  const handleJoin = useCallback((id: string) => {
    navigate({ view: 'board', roomId: id });
  }, [navigate]);

  const handleLeave = useCallback(() => {
    if (isGuest) {
      // Guests can't go to dashboard — clear guest state and show join screen
      sessionStorage.removeItem('beacons-guest');
      setGuestUser(null);
      return;
    }
    setDashKey((k) => k + 1);
    navigate({ view: 'dashboard' });
  }, [navigate, isGuest]);

  const handleLeaveTemplate = useCallback(() => {
    setDashKey((k) => k + 1);
    navigate({ view: 'dashboard', tab: 'templates' });
  }, [navigate]);

  const handleTabChange = useCallback((tab: string) => {
    navigate({ view: 'dashboard', tab }, true);
  }, [navigate]);

  // ---- Listen for browser back/forward ----

  useEffect(() => {
    // Set initial history state so first entry has data
    // Don't replace URL if there's an auth hash (Supabase needs to read it)
    const initial = parseLocation();
    const hash = window.location.hash;
    if (!hash.includes('access_token=') && !hash.includes('linear_token=')) {
      window.history.replaceState(initial, '', navUrl(initial));
    }

    const onPopState = (e: PopStateEvent) => {
      const s: NavState = e.state || parseLocation();
      setNavState(s);
      if (s.view === 'dashboard') {
        setDashKey((k) => k + 1);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="landing">
        <img src="/logo.png" alt="Beacons" className="landing-logo" />
        <h1>Beacons</h1>
      </div>
    );
  }

  // Not authenticated
  if (!activeUser) {
    // If on a board URL and board is public, show guest join option
    if (roomId && boardAccessMode === 'public') {
      return <GuestJoin onSignIn={signIn} onGuestJoin={handleGuestJoin} />;
    }
    return <SignIn onSignIn={signIn} />;
  }

  // Guest trying to access non-board pages → redirect them to sign in
  if (isGuest && !joined) {
    return <SignIn onSignIn={signIn} />;
  }

  // Authenticated but not in a room
  if (!joined) {
    return (
      <Dashboard
        key={dashKey}
        user={user!}
        defaultRoomId={null}
        defaultTab={dashTab}
        onCreateRoom={handleCreate}
        onCreateFromTemplate={handleCreateFromTemplate}
        onCreateTemplate={handleCreateTemplate}
        onEditTemplate={handleEditTemplate}
        onUseTemplate={handleUseTemplate}
        onJoinRoom={handleJoin}
        onTabChange={handleTabChange}
        onSignOut={signOut}
      />
    );
  }

  // In a room (or editing a template)
  const leaveHandler = isTemplateMode ? handleLeaveTemplate : handleLeave;

  return (
    <BoardContext.Provider value={{ state, dispatch, send, userId, onLeave: leaveHandler, templateMode: isTemplateMode, isGuest }}>
      <Board />
    </BoardContext.Provider>
  );
}
