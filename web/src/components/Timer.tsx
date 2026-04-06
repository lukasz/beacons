import { useState, useEffect, useCallback, useRef } from 'react';
import { useBoard } from '../hooks/useBoard';

interface Props {
  onClose: () => void;
}

export default function Timer({ onClose }: Props) {
  const { state, send } = useBoard();
  const { timer } = state;

  const mins = Math.floor(timer.remainingSec / 60);
  const secs = timer.remainingSec % 60;

  const blink = timer.running && timer.remainingSec > 0 && timer.remainingSec <= 30;

  const [editingMins, setEditingMins] = useState(false);
  const [editingSecs, setEditingSecs] = useState(false);
  const minsRef = useRef<HTMLInputElement>(null);
  const secsRef = useRef<HTMLInputElement>(null);

  const adjust = useCallback(
    (delta: number) => {
      send('timer_adjust', { deltaSec: delta });
    },
    [send],
  );

  const commitMins = useCallback((val: string) => {
    setEditingMins(false);
    const n = parseInt(val, 10);
    if (isNaN(n) || n < 0) return;
    const newTotal = n * 60 + secs;
    const delta = newTotal - timer.remainingSec;
    if (delta !== 0) send('timer_adjust', { deltaSec: delta });
  }, [secs, timer.remainingSec, send]);

  const commitSecs = useCallback((val: string) => {
    setEditingSecs(false);
    const n = parseInt(val, 10);
    if (isNaN(n) || n < 0) return;
    const newTotal = mins * 60 + n;
    const delta = newTotal - timer.remainingSec;
    if (delta !== 0) send('timer_adjust', { deltaSec: delta });
  }, [mins, timer.remainingSec, send]);

  useEffect(() => {
    if (editingMins && minsRef.current) {
      minsRef.current.select();
    }
  }, [editingMins]);

  useEffect(() => {
    if (editingSecs && secsRef.current) {
      secsRef.current.select();
    }
  }, [editingSecs]);

  // GAME OVER
  const [showGameOver, setShowGameOver] = useState(false);

  useEffect(() => {
    if (timer.remainingSec === 0 && !timer.running && timer.durationSec > 0) {
      setShowGameOver(true);
      const t = setTimeout(() => setShowGameOver(false), 3000);
      return () => clearTimeout(t);
    }
  }, [timer.remainingSec, timer.running, timer.durationSec]);

  // Dismiss game over on any key
  useEffect(() => {
    if (!showGameOver) return;
    const handler = () => setShowGameOver(false);
    window.addEventListener('keydown', handler);
    window.addEventListener('pointerdown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('pointerdown', handler);
    };
  }, [showGameOver]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, commit: (v: string) => void) => {
    if (e.key === 'Enter') {
      commit(e.currentTarget.value);
    } else if (e.key === 'Escape') {
      setEditingMins(false);
      setEditingSecs(false);
    }
  };

  return (
    <>
      <div className="timer-panel">
        <div className="timer-panel-header">
          <span className="timer-panel-title">Timer</span>
          <button className="timer-panel-close" onClick={onClose}>×</button>
        </div>

        <div className="timer-inline">
          <button
            className="timer-adjust-btn"
            onClick={() => adjust(-30)}
            disabled={timer.remainingSec <= 0}
          >
            −
          </button>
          <div className={`timer-big-display ${blink ? 'blink' : ''}`}>
            {editingMins ? (
              <input
                ref={minsRef}
                className="timer-edit-input"
                type="text"
                inputMode="numeric"
                defaultValue={mins.toString()}
                onBlur={(e) => commitMins(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, commitMins)}
              />
            ) : (
              <span
                className="timer-digit"
                onClick={() => !timer.running && setEditingMins(true)}
                title={timer.running ? undefined : 'Click to edit'}
              >
                {mins}
              </span>
            )}
            <span className="timer-colon">:</span>
            {editingSecs ? (
              <input
                ref={secsRef}
                className="timer-edit-input"
                type="text"
                inputMode="numeric"
                defaultValue={secs.toString().padStart(2, '0')}
                onBlur={(e) => commitSecs(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, commitSecs)}
              />
            ) : (
              <span
                className="timer-digit"
                onClick={() => !timer.running && setEditingSecs(true)}
                title={timer.running ? undefined : 'Click to edit'}
              >
                {secs.toString().padStart(2, '0')}
              </span>
            )}
          </div>
          <button
            className="timer-adjust-btn"
            onClick={() => adjust(30)}
          >
            +
          </button>
        </div>

        <div className="timer-controls">
          {timer.running ? (
            <button
              className="timer-ctrl-btn timer-ctrl-pause"
              onClick={() => send('timer_pause', {})}
            >
              ⏸ Pause
            </button>
          ) : (
            <button
              className="timer-ctrl-btn timer-ctrl-start"
              onClick={() => send('timer_start', {})}
              disabled={timer.remainingSec <= 0}
            >
              ▶ Start
            </button>
          )}
          <button
            className="timer-ctrl-btn timer-ctrl-reset"
            onClick={() => send('timer_reset', {})}
            disabled={timer.remainingSec === timer.durationSec && !timer.running}
          >
            ↺ Reset
          </button>
        </div>
      </div>

      {showGameOver && (
        <div className="game-over-overlay">
          <div className="game-over-content">
            <div className="game-over-text">GAME OVER</div>
            <div className="game-over-sub">PRESS ANY KEY TO CONTINUE</div>
          </div>
        </div>
      )}
    </>
  );
}
