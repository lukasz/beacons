/**
 * Multi-team filter dropdown used by the Boards and Actions tabs.
 * Includes a "Free range" pseudo-team for boards with no team
 * attached, plus a "Manage teams..." entry that opens TeamManager.
 *
 * Lifted from Dashboard.tsx in Phase 5a.
 */
import { useEffect, useRef, useState } from 'react';
import type { Team } from '../../../types';

interface Props {
  teams: Team[];
  selected: string[];
  onChange: (v: string[]) => void;
  onManage: () => void;
}

export default function TeamMultiSelect({ teams, selected, onChange, onManage }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const raf = requestAnimationFrame(() => document.addEventListener('mousedown', handle));
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', handle);
    };
  }, [open]);

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };

  const label = selected.length === 0
    ? 'All teams'
    : selected.length === 1
      ? (selected[0] === 'free-range' ? 'Free range' : teams.find((t) => t.id === selected[0])?.name || 'Team')
      : `${selected.length} teams`;

  return (
    <div className="team-multiselect" ref={ref}>
      <button
        className={`team-multiselect-btn ${selected.length > 0 ? 'active' : ''}`}
        onClick={() => setOpen(!open)}
      >
        <span>{label}</span>
        <span className="team-multiselect-caret">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="team-multiselect-dropdown">
          {teams.map((t) => (
            <label key={t.id} className="team-multiselect-option">
              <input
                type="checkbox"
                checked={selected.includes(t.id)}
                onChange={() => toggle(t.id)}
              />
              <span className="team-multiselect-label">
                {t.linearTeamKey && <span className="team-multiselect-key">{t.linearTeamKey}</span>}
                {t.name}
              </span>
            </label>
          ))}
          <label className="team-multiselect-option">
            <input
              type="checkbox"
              checked={selected.includes('free-range')}
              onChange={() => toggle('free-range')}
            />
            <span className="team-multiselect-label team-multiselect-free">Free range</span>
          </label>
          <div className="team-multiselect-divider" />
          <button className="team-multiselect-manage" onClick={() => { setOpen(false); onManage(); }}>
            Manage teams...
          </button>
          {selected.length > 0 && (
            <button className="team-multiselect-clear" onClick={() => { onChange([]); setOpen(false); }}>
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
