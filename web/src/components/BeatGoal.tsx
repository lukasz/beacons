import { useState, useCallback, useRef, useEffect } from 'react';
import { useBoard } from '../hooks/useBoard';

export default function BeatGoal() {
  const { state, send, dispatch } = useBoard();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [localGoal, setLocalGoal] = useState(state.beatGoal);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync remote
  if (!editing && localGoal !== state.beatGoal) setLocalGoal(state.beatGoal);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commitGoal = useCallback(() => {
    setEditing(false);
    if (localGoal !== state.beatGoal) {
      const meta = {
        sessionName: state.sessionName,
        teamName: state.teamName,
        beatGoal: localGoal,
        beatGoalHit: state.beatGoalHit,
      };
      dispatch({ type: 'update_meta', payload: meta });
      send('update_meta', meta);
    }
  }, [localGoal, state, send, dispatch]);

  const setHit = useCallback(
    (hit: boolean) => {
      const newVal = state.beatGoalHit === hit ? null : hit;
      const meta = {
        sessionName: state.sessionName,
        teamName: state.teamName,
        beatGoal: state.beatGoal,
        beatGoalHit: newVal,
      };
      dispatch({ type: 'update_meta', payload: meta });
      send('update_meta', meta);
      setExpanded(false);
    },
    [state, send, dispatch],
  );

  const isHit = state.beatGoalHit === true;
  const isMiss = state.beatGoalHit === false;
  const hasGoal = !!state.beatGoal;

  // Collapsed: just a small pill label
  if (!expanded) {
    return (
      <div
        className={`beat-goal-pill ${isHit ? 'hit' : ''} ${isMiss ? 'miss' : ''}`}
        onClick={() => setExpanded(true)}
      >
        <span className="beat-goal-pill-icon">🎯</span>
        <span className="beat-goal-pill-text">
          {hasGoal ? state.beatGoal : 'Set beat goal...'}
        </span>
        {isHit && <span className="beat-goal-pill-status">✅</span>}
        {isMiss && <span className="beat-goal-pill-status">❌</span>}
      </div>
    );
  }

  // Expanded: editable + hit/miss toggles
  return (
    <div className={`beat-goal-pill expanded ${isHit ? 'hit' : ''} ${isMiss ? 'miss' : ''}`}>
      <span className="beat-goal-pill-icon">🎯</span>

      {editing ? (
        <input
          ref={inputRef}
          className="beat-goal-pill-edit"
          maxLength={256}
          value={localGoal}
          placeholder="What was the goal?"
          onChange={(e) => setLocalGoal(e.target.value)}
          onBlur={commitGoal}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') { setLocalGoal(state.beatGoal); setEditing(false); }
          }}
        />
      ) : (
        <span
          className={`beat-goal-pill-text editable ${!hasGoal ? 'placeholder' : ''}`}
          onClick={() => setEditing(true)}
        >
          {hasGoal ? state.beatGoal : 'Click to set goal...'}
        </span>
      )}

      <div className="beat-goal-pill-toggles">
        <button
          className={`beat-goal-emoji-btn ${isHit ? 'active' : ''}`}
          onClick={() => setHit(true)}
          title="Goal hit!"
        >
          ✅
        </button>
        <button
          className={`beat-goal-emoji-btn ${isMiss ? 'active' : ''}`}
          onClick={() => setHit(false)}
          title="Goal missed"
        >
          ❌
        </button>
      </div>
    </div>
  );
}
