/**
 * Single-team picker for the Teams tab. Click outside to close.
 *
 * Lifted from Dashboard.tsx in Phase 5a.
 */
import { useEffect, useRef, useState } from 'react';
import type { Team } from '../../../types';

interface Props {
  teams: Team[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export default function TeamTabSelector({ teams, selectedId, onSelect }: Props) {
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

  const selected = selectedId ? teams.find((t) => t.id === selectedId) : null;

  return (
    <div className="team-tab-dropdown" ref={ref}>
      <button className="team-tab-dropdown-btn" onClick={() => setOpen(!open)}>
        <span>{selected ? selected.name : 'Select team...'}</span>
        <span className="team-tab-dropdown-caret">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="team-tab-dropdown-menu">
          {teams.map((t) => (
            <button
              key={t.id}
              className={`team-tab-dropdown-item ${selectedId === t.id ? 'active' : ''}`}
              onClick={() => { onSelect(t.id); setOpen(false); }}
            >
              {t.linearTeamKey && <span className="team-tab-dropdown-key">{t.linearTeamKey}</span>}
              <span>{t.name}</span>
              {selectedId === t.id && <span className="team-tab-dropdown-check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
