/**
 * Modal that previews a Linear cycle/project's stats and lets the user
 * pick a template before creating a retro board for it.
 *
 * Lifted from Dashboard.tsx in Phase 5a.
 */
import { useState } from 'react';
import { COLORS } from '../../../types';

interface TemplateOption {
  id: string;
  sessionName: string;
  sections: { title: string; colorIdx: number }[];
}

interface Props {
  name: string;
  dateRange: string;
  hasScope: boolean;
  startPts: number;
  totalPts: number;
  donePts: number;
  scopeChange: number;
  scopeChangeClass: string;
  completionPct: number;
  templates: TemplateOption[];
  onClose: () => void;
  onCreate: (templateId: string | null) => void;
}

export default function TeamTabCreateModal({
  name, dateRange, hasScope, startPts, totalPts, donePts,
  scopeChange, scopeChangeClass, completionPct,
  templates, onClose, onCreate,
}: Props) {
  const [selectedTplId, setSelectedTplId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [tplSearch, setTplSearch] = useState('');
  const filtered = tplSearch
    ? templates.filter((t) => (t.sessionName || '').toLowerCase().includes(tplSearch.toLowerCase()))
    : templates;

  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <button className="dash-modal-close" onClick={onClose}>✕</button>
        <h3 className="dash-modal-title">Create Retro Board</h3>

        <div className="ttcm-header">
          <strong>{name}</strong>
          {dateRange && <span className="ttcm-dates">{dateRange}</span>}
        </div>

        {hasScope && (
          <div className="team-tab-cycle-stats-grid" style={{ margin: '12px 0' }}>
            <div className="team-tab-cycle-stat">
              <span className="tt-stat-val">{startPts}</span>
              <span className="tt-stat-lbl">Starting</span>
            </div>
            <div className="team-tab-cycle-stat">
              <span className="tt-stat-val">{totalPts}</span>
              <span className="tt-stat-lbl">Final scope</span>
            </div>
            <div className="team-tab-cycle-stat">
              <span className={`tt-stat-val ${scopeChangeClass}`}>{scopeChange > 0 ? '+' : ''}{scopeChange}%</span>
              <span className="tt-stat-lbl">Scope change</span>
            </div>
            <div className="team-tab-cycle-stat">
              <span className="tt-stat-val tt-stat-done">
                {donePts} <span className="tt-stat-sub">· {completionPct}%</span>
              </span>
              <span className="tt-stat-lbl">Completed</span>
            </div>
          </div>
        )}

        <div className="ttcm-template-section">
          <div className="ttcm-template-header">
            <label className="ttcm-label">Template</label>
            <input
              className="ttcm-search"
              type="text"
              placeholder="Search..."
              value={tplSearch}
              onChange={(e) => setTplSearch(e.target.value)}
            />
          </div>
          <div className="ttcm-template-list">
            {!tplSearch && (
              <div
                className={`ttcm-template-option ${selectedTplId === null ? 'active' : ''}`}
                onClick={() => setSelectedTplId(null)}
              >
                <span className="ttcm-tpl-name">Blank</span>
                <span className="ttcm-tpl-sections">
                  <span className="linear-tpl-pill" style={{ background: '#4ADE8022', color: '#4ADE80' }}>What went well</span>
                  <span className="linear-tpl-pill" style={{ background: '#F8717122', color: '#F87171' }}>What could be improved</span>
                </span>
              </div>
            )}
            {filtered.map((tpl) => (
              <div
                key={tpl.id}
                className={`ttcm-template-option ${selectedTplId === tpl.id ? 'active' : ''}`}
                onClick={() => setSelectedTplId(tpl.id)}
              >
                <span className="ttcm-tpl-name">{tpl.sessionName || 'Untitled'}</span>
                <span className="ttcm-tpl-sections">
                  {tpl.sections.slice(0, 4).map((s, i) => (
                    <span
                      key={i}
                      className="linear-tpl-pill"
                      style={{
                        background: COLORS[s.colorIdx % COLORS.length] + '22',
                        color: COLORS[s.colorIdx % COLORS.length],
                      }}
                    >
                      {s.title}
                    </span>
                  ))}
                  {tpl.sections.length > 4 && (
                    <span className="linear-tpl-pill-more">+{tpl.sections.length - 4}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        <button
          className="btn btn-primary dash-modal-btn"
          disabled={creating}
          onClick={async () => {
            setCreating(true);
            await onCreate(selectedTplId);
          }}
        >
          {creating ? 'Creating…' : 'Create Retro Board'}
        </button>
      </div>
    </div>
  );
}
