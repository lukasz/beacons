import { useState, useCallback } from 'react';
import { useTheme } from '../hooks/useTheme';
import type { AuthUser } from '../hooks/useAuth';

interface Props {
  user: AuthUser;
  defaultRoomId: string | null;
  onCreateRoom: () => void;
  onJoinRoom: (roomId: string) => void;
  onSignOut: () => void;
}

export default function Landing({ user, defaultRoomId, onCreateRoom, onJoinRoom, onSignOut }: Props) {
  const [roomId, setRoomId] = useState(defaultRoomId || '');
  const { theme, toggleTheme } = useTheme();
  const isGeek = theme === 'dark';

  const hasCode = roomId.trim().length > 0;
  const joinIsDefault = hasCode;

  const handleJoin = useCallback(() => {
    if (hasCode) onJoinRoom(roomId.trim());
  }, [hasCode, roomId, onJoinRoom]);

  const handleEnter = useCallback(() => {
    if (joinIsDefault) handleJoin();
    else onCreateRoom();
  }, [joinIsDefault, handleJoin, onCreateRoom]);

  const handleCodeChange = useCallback((val: string) => {
    const cleaned = val.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
    setRoomId(cleaned);
  }, []);

  return (
    <div className="landing">
      <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="theme-toggle" onClick={toggleTheme}>
          <span className="theme-toggle-label">{isGeek ? 'Geek Mode' : 'Vanilla Mode'}</span>
          <div className={`theme-toggle-track ${isGeek ? 'geek' : ''}`}>
            <div className="theme-toggle-thumb">
              {isGeek ? '🌙' : '☀️'}
            </div>
          </div>
        </div>
      </div>

      <img src="/logo.png" alt="Beacons" className="landing-logo" />
      <h1>Beacons</h1>
      <p style={{ color: 'var(--tem-primary)', fontSize: '1.05rem', fontWeight: 500, letterSpacing: '0.02em', marginTop: -8 }}>Retro as it should be</p>
      <p className="landing-engraved">Whiteboarding That's Fun</p>

      {/* User info */}
      <div className="landing-user">
        {user.avatarUrl && (
          <img src={user.avatarUrl} alt="" className="landing-user-avatar" referrerPolicy="no-referrer" />
        )}
        <span className="landing-user-name">{user.name}</span>
        <button className="landing-sign-out" onClick={onSignOut}>Sign out</button>
      </div>

      <div className="landing-options">
        {/* Create box */}
        <div className="landing-box">
          <span className="landing-box-label">Start fresh</span>
          <button
            className={`btn landing-cta ${!joinIsDefault ? 'btn-primary' : 'btn-secondary'}`}
            onClick={onCreateRoom}
          >
            Create New Board
          </button>
        </div>

        <span className="landing-or">or</span>

        {/* Join box */}
        <div className="landing-box">
          <span className="landing-box-label">Join existing</span>
          <div className="landing-join-row">
            <input
              className="landing-code"
              placeholder="Board code"
              value={roomId}
              onChange={(e) => handleCodeChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleEnter(); }}
              autoFocus
              maxLength={16}
            />
            <button
              className={`btn landing-cta ${joinIsDefault ? 'btn-primary' : 'btn-secondary'}`}
              disabled={!hasCode}
              onClick={handleJoin}
            >
              Join
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
