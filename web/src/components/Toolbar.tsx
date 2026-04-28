import { useState, useCallback, useRef, useEffect } from 'react';
import { useBoard } from '../hooks/useBoard';
import { COLORS } from '../types';
import { useTheme } from '../hooks/useTheme';
import { storage } from '../lib/storage';
import { hashCode } from '../lib/hash';

export default function Toolbar() {
  const { state, send, dispatch, onLeave, templateMode, isGuest } = useBoard();
  const { theme, toggleTheme } = useTheme();

  const connectedUsers = Object.values(state.users).filter((u) => u.connected);
  const isGeek = theme === 'dark';

  // --- Session name ---
  const [editingName, setEditingName] = useState(false);
  const [localName, setLocalName] = useState(state.sessionName);
  const nameRef = useRef<HTMLInputElement>(null);

  // --- Team ---
  const [editingTeam, setEditingTeam] = useState(false);
  const [localTeam, setLocalTeam] = useState(state.teamName);
  const teamRef = useRef<HTMLInputElement>(null);

  const sendMeta = useCallback(
    (partial: { sessionName?: string; teamName?: string }) => {
      const meta = {
        sessionName: partial.sessionName ?? state.sessionName,
        teamName: partial.teamName ?? state.teamName,
        beatGoal: state.beatGoal,
        beatGoalHit: state.beatGoalHit,
      };
      // Optimistic local update so sync-back doesn't revert the edit
      dispatch({ type: 'update_meta', payload: meta });
      send('update_meta', meta);
    },
    [send, dispatch, state],
  );

  const commitName = useCallback(() => {
    setEditingName(false);
    if (localName !== state.sessionName) {
      sendMeta({ sessionName: localName });
    }
  }, [localName, state.sessionName, sendMeta]);

  const commitTeam = useCallback(() => {
    setEditingTeam(false);
    if (localTeam !== state.teamName) {
      sendMeta({ teamName: localTeam });
    }
  }, [localTeam, state.teamName, sendMeta]);

  // Sync local state from remote
  if (!editingName && localName !== state.sessionName) setLocalName(state.sessionName);
  if (!editingTeam && localTeam !== state.teamName) setLocalTeam(state.teamName);

  // Auto-focus inputs when entering edit mode
  useEffect(() => {
    if (editingName && nameRef.current) {
      nameRef.current.focus();
      nameRef.current.select();
    }
  }, [editingName]);

  useEffect(() => {
    if (editingTeam && teamRef.current) {
      teamRef.current.focus();
      teamRef.current.select();
    }
  }, [editingTeam]);

  // --- Cursors toggle ---
  const [cursorsOn, setCursorsOn] = useState(() => storage.read('cursors') !== 'off');
  const toggleCursors = useCallback(() => {
    const next = !cursorsOn;
    setCursorsOn(next);
    storage.write('cursors', next ? 'on' : 'off');
    window.dispatchEvent(new CustomEvent('cursors-toggle', { detail: next }));
  }, [cursorsOn]);

  const hasTeam = !!state.teamName;
  const isBoundToTeam = !!state.teamId; // team boards have non-editable "by" field

  // --- Settings panel ---
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  const accessMode = state.accessMode || 'org';

  const handleAccessChange = useCallback(
    (mode: 'org' | 'public') => {
      dispatch({ type: 'update_access', payload: { accessMode: mode } });
      send('update_access', { accessMode: mode });
    },
    [send, dispatch],
  );

  // Close settings on click outside
  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [settingsOpen]);

  // --- Room ID copy ---
  const [copied, setCopied] = useState(false);
  const copyTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const copyRoomId = useCallback(() => {
    navigator.clipboard.writeText(state.id).then(() => {
      setCopied(true);
      clearTimeout(copyTimeout.current);
      copyTimeout.current = setTimeout(() => setCopied(false), 2000);
    });
  }, [state.id]);

  return (
    <div className="toolbar">
      <div className="toolbar-brand" onClick={onLeave} style={{ cursor: 'pointer' }} title="Back to dashboard">
        <img src="/logo.png" alt="" className="toolbar-logo" />
        <span className="toolbar-brand-name">Beacons</span>
      </div>
      <span className="room-id" onClick={copyRoomId} title="Click to copy board code">
        {copied ? 'Copied!' : state.id}
      </span>

      {!templateMode && !isGuest && (
        <div className="toolbar-settings-wrap" ref={settingsRef}>
          <button
            className={`toolbar-settings-btn ${settingsOpen ? 'active' : ''}`}
            onClick={() => setSettingsOpen((o) => !o)}
            title="Board settings"
          >
            ⚙
          </button>
          {settingsOpen && (
            <div className="settings-panel">
              <div className="settings-panel-title">Board access</div>
              <div className="settings-access-toggle">
                <button
                  className={`settings-access-option ${accessMode === 'org' ? 'active' : ''}`}
                  onClick={() => handleAccessChange('org')}
                >
                  <span className="settings-access-icon">🔒</span>
                  <span>Within org</span>
                </button>
                <button
                  className={`settings-access-option ${accessMode === 'public' ? 'active' : ''}`}
                  onClick={() => handleAccessChange('public')}
                >
                  <span className="settings-access-icon">🔗</span>
                  <span>Anyone with link</span>
                </button>
              </div>
              {accessMode === 'public' && (
                <p className="settings-access-hint">
                  Anyone with the board link can join — even without an account.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Center: Session metadata (absolutely positioned) */}
      <div className="session-meta">
        {editingName ? (
          <input
            ref={nameRef}
            className="session-name-edit"
            maxLength={128}
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setLocalName(state.sessionName); setEditingName(false); } }}
          />
        ) : (
          <span
            className={`session-name ${!state.sessionName ? 'placeholder' : ''}`}
            onClick={() => setEditingName(true)}
          >
            {state.sessionName || 'Beat name or project name...'}
          </span>
        )}

        {isBoundToTeam ? (
          <span className="session-team">
            <span className="session-team-by">by</span>
            <span
              className="session-team-name session-team-link"
              onClick={() => {
                storage.write('teamTabSelected', state.teamId!);
                window.location.href = '/?tab=teams';
              }}
              title={`Go to ${state.teamName} team page`}
            >
              {state.teamName}
            </span>
          </span>
        ) : editingTeam ? (
          <span className="session-team">
            <span className="session-team-by">by</span>
            <input
              ref={teamRef}
              className="session-team-edit"
              value={localTeam}
              onChange={(e) => setLocalTeam(e.target.value)}
              onBlur={commitTeam}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setLocalTeam(state.teamName); setEditingTeam(false); } }}
            />
          </span>
        ) : hasTeam ? (
          <span className="session-team" onClick={() => setEditingTeam(true)}>
            <span className="session-team-by">by</span>
            <span className="session-team-name">{state.teamName}</span>
          </span>
        ) : (
          <button
            className="session-team-add"
            onClick={() => setEditingTeam(true)}
          >
            + owner
          </button>
        )}
      </div>

      <div className="toolbar-spacer" />

      {templateMode && (
        <span className="toolbar-template-badge">Template</span>
      )}

      {!templateMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', flexShrink: 0 }}>
          <span>Cursors</span>
          <div
            className={`toggle ${cursorsOn ? 'active' : ''}`}
            onClick={toggleCursors}
          />
        </div>
      )}

      <div className="theme-toggle" onClick={toggleTheme}>
        <span className="theme-toggle-label">{isGeek ? 'Geek Mode' : 'Vanilla Mode'}</span>
        <div className={`theme-toggle-track ${isGeek ? 'geek' : ''}`}>
          <div className="theme-toggle-thumb">
            {isGeek ? '🌙' : '☀️'}
          </div>
        </div>
      </div>

      {!templateMode && (
        <div className="users-indicator">
          {connectedUsers.map((u) => (
            <div
              key={u.id}
              className="user-avatar"
              style={{ background: COLORS[Math.abs(hashCode(u.id)) % COLORS.length] }}
              title={u.name}
            >
              {u.name.slice(0, 2).toUpperCase()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
