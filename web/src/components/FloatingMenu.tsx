import { useCallback, useState } from 'react';
import { COLORS, POSTIT_COLORS } from '../types';

export type CreationMode = 'section' | 'group' | 'postit' | null;

interface Props {
  activeMode: CreationMode;
  onModeChange: (mode: CreationMode) => void;
  timerOpen: boolean;
  onToggleTimer: () => void;
  hasVoteActivity: boolean;
  stickyColorIdx: number;
  onStickyColorChange: (idx: number) => void;
  sectionColorIdx: number;
  onSectionColorChange: (idx: number) => void;
  templateMode?: boolean;
  onGiphyOpen?: () => void;
}

export default function FloatingMenu({
  activeMode, onModeChange, timerOpen, onToggleTimer, hasVoteActivity,
  stickyColorIdx, onStickyColorChange, sectionColorIdx, onSectionColorChange,
  templateMode, onGiphyOpen,
}: Props) {
  const [colorPickerFor, setColorPickerFor] = useState<'section' | 'postit' | null>(null);

  const handleClick = useCallback(
    (mode: CreationMode) => {
      onModeChange(activeMode === mode ? null : mode);
    },
    [activeMode, onModeChange],
  );

  const handleColorClick = useCallback(
    (mode: 'section' | 'postit', e: React.MouseEvent) => {
      e.stopPropagation();
      setColorPickerFor(colorPickerFor === mode ? null : mode);
    },
    [colorPickerFor],
  );

  return (
    <div className="floating-menu">
      {/* Section */}
      <div className="floating-menu-item-wrap">
        <button
          className={`floating-menu-btn ${activeMode === 'section' ? 'active' : ''}`}
          onClick={() => handleClick('section')}
          title="Section"
        >
          <span className="floating-menu-icon">▦</span>
          <span className="floating-menu-label">Section</span>
          <span
            className="floating-menu-color-dot"
            style={{ background: COLORS[sectionColorIdx] }}
            onClick={(e) => handleColorClick('section', e)}
          />
        </button>
        {colorPickerFor === 'section' && (
          <div className="floating-menu-colors">
            {COLORS.map((c, i) => (
              <button
                key={i}
                className={`fm-color-dot ${i === sectionColorIdx ? 'active' : ''}`}
                style={{ background: c }}
                onClick={(e) => { e.stopPropagation(); onSectionColorChange(i); setColorPickerFor(null); }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Group */}
      <button
        className={`floating-menu-btn ${activeMode === 'group' ? 'active' : ''}`}
        onClick={() => handleClick('group')}
        title="Group"
      >
        <span className="floating-menu-icon">⊞</span>
        <span className="floating-menu-label">Group</span>
      </button>

      {/* Sticky */}
      <div className="floating-menu-item-wrap">
        <button
          className={`floating-menu-btn ${activeMode === 'postit' ? 'active' : ''}`}
          onClick={() => handleClick('postit')}
          title="Sticky"
        >
          <span className="floating-menu-icon">✎</span>
          <span className="floating-menu-label">Sticky</span>
          <span
            className="floating-menu-color-dot"
            style={{ background: POSTIT_COLORS[stickyColorIdx] }}
            onClick={(e) => handleColorClick('postit', e)}
          />
        </button>
        {colorPickerFor === 'postit' && (
          <div className="floating-menu-colors">
            {POSTIT_COLORS.map((c, i) => (
              <button
                key={i}
                className={`fm-color-dot ${i === stickyColorIdx ? 'active' : ''}`}
                style={{ background: c }}
                onClick={(e) => { e.stopPropagation(); onStickyColorChange(i); setColorPickerFor(null); }}
              />
            ))}
          </div>
        )}
      </div>

      {!templateMode && (
        <>
          <div className="floating-menu-divider" />

          <button
            className={`floating-menu-btn ${timerOpen ? 'active' : ''}`}
            onClick={onToggleTimer}
            title="Timer"
          >
            <span className="floating-menu-icon">◷</span>
            <span className="floating-menu-label">Timer</span>
          </button>

          <button
            className={`floating-menu-btn ${hasVoteActivity ? 'active' : ''}`}
            onClick={() => window.dispatchEvent(new CustomEvent('toggle-vote-panel'))}
            title="Voting"
          >
            <span className="floating-menu-icon">⧉</span>
            <span className="floating-menu-label">Voting</span>
          </button>
        </>
      )}

      <div className="floating-menu-divider" />

      <button
        className="floating-menu-btn"
        onClick={onGiphyOpen}
        title="GIF"
      >
        <span className="floating-menu-icon">◈</span>
        <span className="floating-menu-label">GIF</span>
      </button>
    </div>
  );
}
