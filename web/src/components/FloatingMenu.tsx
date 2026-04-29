import { useCallback, useState } from 'react';
import { COLORS, POSTIT_COLORS } from '../types';

export type CreationMode = 'section' | 'group' | 'postit' | null;

interface Props {
  activeMode: CreationMode;
  onModeChange: (mode: CreationMode) => void;
  timerOpen: boolean;
  onToggleTimer: () => void;
  hasVoteActivity: boolean;
  onToggleVotePanel: () => void;
  stickyColorIdx: number;
  onStickyColorChange: (idx: number) => void;
  sectionColorIdx: number;
  onSectionColorChange: (idx: number) => void;
  templateMode?: boolean;
  onGiphyOpen?: () => void;
  hideMode: boolean;
  onToggleHide: () => void;
  isFacilitator: boolean;
  allHidden: boolean;
  onToggleHideAll: () => void;
}

export default function FloatingMenu({
  activeMode, onModeChange, timerOpen, onToggleTimer, hasVoteActivity,
  onToggleVotePanel,
  stickyColorIdx, onStickyColorChange, sectionColorIdx, onSectionColorChange,
  templateMode, onGiphyOpen,
  hideMode, onToggleHide, isFacilitator, allHidden, onToggleHideAll,
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
            onClick={onToggleVotePanel}
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

      {!templateMode && (
        <>
          <div className="floating-menu-divider" />

          <button
            className={`floating-menu-btn ${hideMode ? 'active' : ''}`}
            onClick={onToggleHide}
            title={hideMode ? 'Reveal my notes' : 'Hide my notes'}
          >
            <span className="floating-menu-icon">{hideMode ? '🙈' : '👁'}</span>
            <span className="floating-menu-label">{hideMode ? 'Hidden' : 'Hide mine'}</span>
          </button>

          {isFacilitator && (
            <button
              className={`floating-menu-btn ${allHidden ? 'active' : ''}`}
              onClick={onToggleHideAll}
              title={allHidden ? "Reveal everyone's notes" : "Hide everyone's notes"}
            >
              <span className="floating-menu-icon">{allHidden ? '🔒' : '🔓'}</span>
              <span className="floating-menu-label">{allHidden ? 'All hidden' : 'Hide all'}</span>
            </button>
          )}
        </>
      )}
    </div>
  );
}
