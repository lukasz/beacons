/**
 * Modal for creating, editing, and deleting teams. Optionally maps a
 * team to a Linear team so cycle/project boards land in the right
 * place.
 *
 * Lifted from Dashboard.tsx in Phase 5a.
 */
import { useCallback, useState } from 'react';
import { fetchTeams as fetchLinearTeams, type LinearTeam } from '../../../linearClient';
import { storage } from '../../../lib/storage';
import type { Team } from '../../../types';

interface Props {
  teams: Team[];
  userId: string;
  onCreate: (name: string, linearTeamId?: string, linearTeamKey?: string) => void;
  onUpdate: (team: Team) => void;
  onDelete: (teamId: string) => void;
  onClose: () => void;
}

export default function TeamManager({ teams, onCreate, onUpdate, onDelete, onClose }: Props) {
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const [editTeam, setEditTeam] = useState<Team | null>(null);
  const [name, setName] = useState('');
  const [linearTeamId, setLinearTeamId] = useState('');
  const [linearTeamKey, setLinearTeamKey] = useState('');
  const [linearTeams, setLinearTeams] = useState<LinearTeam[]>([]);
  const [linearLoading, setLinearLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadLinearTeams = useCallback(async () => {
    const apiKey = storage.read('linearApiKey');
    if (!apiKey) return;
    setLinearLoading(true);
    try {
      setLinearTeams(await fetchLinearTeams(apiKey));
    } catch (e) {
      console.error('Failed to load Linear teams:', e);
    }
    setLinearLoading(false);
  }, []);

  const startCreate = useCallback(() => {
    setName('');
    setLinearTeamId('');
    setLinearTeamKey('');
    setView('create');
    loadLinearTeams();
  }, [loadLinearTeams]);

  const startEdit = useCallback((team: Team) => {
    setEditTeam(team);
    setName(team.name);
    setLinearTeamId(team.linearTeamId || '');
    setLinearTeamKey(team.linearTeamKey || '');
    setView('edit');
    loadLinearTeams();
  }, [loadLinearTeams]);

  const handleSave = useCallback(() => {
    if (!name.trim()) return;
    if (view === 'create') {
      onCreate(name.trim(), linearTeamId || undefined, linearTeamKey || undefined);
    } else if (view === 'edit' && editTeam) {
      onUpdate({
        ...editTeam,
        name: name.trim(),
        linearTeamId: linearTeamId || undefined,
        linearTeamKey: linearTeamKey || undefined,
      });
    }
    setView('list');
  }, [view, name, linearTeamId, linearTeamKey, editTeam, onCreate, onUpdate]);

  const selectLinearTeam = useCallback((lt: LinearTeam) => {
    setLinearTeamId(lt.id);
    setLinearTeamKey(lt.key);
    if (!name.trim()) setName(lt.name);
  }, [name]);

  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <button className="dash-modal-close" onClick={onClose}>✕</button>

        {view === 'list' && (
          <>
            <h3 className="dash-modal-title">Manage Teams</h3>
            {teams.length === 0 ? (
              <div className="dash-empty" style={{ padding: '24px 0' }}>
                <p>No teams yet. Create one to organize your boards.</p>
              </div>
            ) : (
              <div className="team-manager-list">
                {teams.map((t) => (
                  <div key={t.id} className="team-manager-item">
                    <div className="team-manager-info">
                      <span className="team-manager-name">{t.name}</span>
                      {t.linearTeamKey && <span className="team-manager-key">{t.linearTeamKey}</span>}
                    </div>
                    <div className="team-manager-actions">
                      <button className="team-manager-btn" onClick={() => startEdit(t)} title="Edit">✏️</button>
                      <button className="team-manager-btn team-manager-btn-danger" onClick={() => setConfirmDeleteId(t.id)} title="Delete">🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={startCreate}>
              + New Team
            </button>
          </>
        )}

        {(view === 'create' || view === 'edit') && (
          <>
            <h3 className="dash-modal-title">{view === 'create' ? 'Create Team' : 'Edit Team'}</h3>

            <label className="tpl-label">Team name</label>
            <input
              className="dash-modal-input"
              placeholder="e.g. Engineering, Design..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />

            <label className="tpl-label" style={{ marginTop: 12 }}>Linear team mapping (optional)</label>
            {linearLoading ? (
              <div className="dash-loading" style={{ padding: 12 }}>Loading Linear teams...</div>
            ) : linearTeams.length > 0 ? (
              <div className="team-linear-list">
                {linearTeams.map((lt) => (
                  <button
                    key={lt.id}
                    className={`team-linear-item ${linearTeamId === lt.id ? 'active' : ''}`}
                    onClick={() => selectLinearTeam(lt)}
                  >
                    <span className="team-linear-key">{lt.key}</span>
                    <span>{lt.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0' }}>
                Connect Linear from "New Board → From Linear" to map teams.
              </p>
            )}

            {linearTeamId && (
              <div style={{ fontSize: '0.82rem', color: 'var(--color-3)', marginTop: 4 }}>
                Mapped to Linear team: <strong>{linearTeamKey}</strong>
                <button
                  style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.82rem' }}
                  onClick={() => { setLinearTeamId(''); setLinearTeamKey(''); }}
                >
                  Remove
                </button>
              </div>
            )}

            <div className="dash-modal-actions" style={{ marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setView('list')}>Back</button>
              <button className="btn btn-primary" disabled={!name.trim()} onClick={handleSave}>
                {view === 'create' ? 'Create' : 'Save'}
              </button>
            </div>
          </>
        )}

        {confirmDeleteId && (
          <div className="team-delete-confirm">
            <p>Delete this team? Boards will become free range.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary btn-small" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger btn-small" onClick={() => { onDelete(confirmDeleteId); setConfirmDeleteId(null); }}>Delete</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
