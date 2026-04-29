/**
 * "New Board" chooser — three creation paths: From Linear, From
 * Template, Free Range. The dashboard renders this in response to a
 * "+ New Board" click.
 *
 * Lifted from Dashboard.tsx in Phase 5a.
 */
import type { TemplateBoardItem } from '../../../services/boards';

interface Props {
  preTemplate: TemplateBoardItem | null;
  onClose: () => void;
  onClearPreTemplate: () => void;
  onPickTemplate: (tpl: TemplateBoardItem) => void;
  onPickFromTemplate: () => void;
  onPickFromLinear: () => void;
  onFreeRange: () => void;
}

export default function NewBoardModal({
  preTemplate,
  onClose,
  onClearPreTemplate,
  onPickTemplate,
  onPickFromTemplate,
  onPickFromLinear,
  onFreeRange,
}: Props) {
  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal dash-newboard-modal" onClick={(e) => e.stopPropagation()}>
        <button className="dash-modal-close" onClick={onClose}>✕</button>
        <h3 className="dash-modal-title">New Board</h3>
        {preTemplate && (
          <div className="dash-newboard-preselected">
            <span className="dash-newboard-preselected-label">Template:</span>
            <span className="dash-newboard-preselected-name">{preTemplate.sessionName || 'Untitled'}</span>
            <button className="dash-newboard-preselected-clear" onClick={onClearPreTemplate}>✕</button>
          </div>
        )}
        <p className="dash-modal-desc">Choose how to set up your board</p>
        <div className="dash-newboard-options">
          <div className="dash-newboard-card" onClick={onPickFromLinear}>
            <span className="dash-newboard-icon">
              <svg width="24" height="24" viewBox="0 0 100 100" fill="none">
                <path d="M2.4 60.7a50 50 0 0 0 36.9 36.9L2.4 60.7z" fill="currentColor"/>
                <path d="M.2 49.2a50 50 0 0 0 1.3 8.3L46.6 2.4A50 50 0 0 0 .2 49.2z" fill="currentColor"/>
                <path d="M97.6 39.3a50 50 0 0 0-36.9-36.9l36.9 36.9z" fill="currentColor"/>
                <path d="M99.8 50.8a50 50 0 0 0-1.3-8.3L53.4 97.6a50 50 0 0 0 46.4-46.8z" fill="currentColor"/>
              </svg>
            </span>
            <span className="dash-newboard-label">From Linear</span>
            <span className="dash-newboard-desc">Create a retro from a cycle or project</span>
          </div>
          {preTemplate ? (
            <div className="dash-newboard-card dash-newboard-card-highlight" onClick={() => onPickTemplate(preTemplate)}>
              <span className="dash-newboard-icon">📋</span>
              <span className="dash-newboard-label">Use Template</span>
              <span className="dash-newboard-desc">Create board from "{preTemplate.sessionName || 'Untitled'}"</span>
            </div>
          ) : (
            <div className="dash-newboard-card" onClick={onPickFromTemplate}>
              <span className="dash-newboard-icon">📋</span>
              <span className="dash-newboard-label">From Template</span>
              <span className="dash-newboard-desc">Use a saved template with pre-defined sections</span>
            </div>
          )}
          <div className="dash-newboard-card" onClick={onFreeRange}>
            <span className="dash-newboard-icon">🐔</span>
            <span className="dash-newboard-label">Free Range</span>
            <span className="dash-newboard-desc">Start with a completely empty board</span>
          </div>
        </div>
      </div>
    </div>
  );
}
