/**
 * Pick one of the user's saved templates to create a board from.
 *
 * Lifted from Dashboard.tsx in Phase 5a.
 */
import type { TemplateBoardItem } from '../../../services/boards';

interface Props {
  templates: TemplateBoardItem[];
  onClose: () => void;
  onPick: (tpl: TemplateBoardItem) => void;
}

export default function TemplatePickerModal({ templates, onClose, onPick }: Props) {
  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal" onClick={(e) => e.stopPropagation()}>
        <button className="dash-modal-close" onClick={onClose}>✕</button>
        <h3 className="dash-modal-title">Choose a Template</h3>
        {templates.length === 0 ? (
          <div className="dash-empty" style={{ padding: '24px 0' }}>
            <p>No templates yet. Create one from the Templates tab.</p>
          </div>
        ) : (
          <div className="dash-template-pick-list">
            {templates.map((tpl) => (
              <div key={tpl.id} className="dash-template-pick-item" onClick={() => onPick(tpl)}>
                <span className="dash-template-pick-name">{tpl.sessionName || 'Untitled'}</span>
                <span className="dash-template-pick-info">{tpl.sectionCount} sections · {tpl.stickyCount} stickies</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
