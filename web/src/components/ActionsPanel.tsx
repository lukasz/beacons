import { useState, useCallback, useRef, useEffect } from 'react';
import { useBoard } from '../hooks/useBoard';
import {
  fetchTeams, fetchTeamMembers, createIssue,
  type LinearTeam, type LinearMember,
} from '../linearClient';
import { supabase } from '../supabaseClient';
import { storage } from '../lib/storage';

export interface PreviousAction {
  id: string;
  text: string;
  authorName: string;
  createdAt: number;
  linearUrl?: string;
  linearKey?: string;
  sourceBoardId: string;
  sourceSessionName: string;
}

export async function fetchPreviousActions(teamId: string, excludeBoardId: string): Promise<PreviousAction[]> {
  const { data, error } = await supabase
    .from('boards')
    .select('id, state->actions, state->sessionName')
    .eq('team_id', teamId)
    .neq('id', excludeBoardId)
    .is('is_template', false)
    .order('updated_at', { ascending: false })
    .limit(10);

  if (error || !data) return [];

  const results: PreviousAction[] = [];
  for (const row of data) {
    const actions = (row.actions || {}) as Record<string, {
      id: string; text: string; done: boolean; authorName: string;
      createdAt: number; linearUrl?: string; linearKey?: string;
    }>;
    for (const a of Object.values(actions)) {
      if (!a.done) {
        results.push({
          id: a.id,
          text: a.text,
          authorName: a.authorName,
          createdAt: a.createdAt,
          linearUrl: a.linearUrl,
          linearKey: a.linearKey,
          sourceBoardId: row.id as string,
          sourceSessionName: (row.sessionName as string) || 'Untitled',
        });
      }
    }
  }
  results.sort((a, b) => b.createdAt - a.createdAt);
  return results;
}

const LINEAR_SVG = (size: number) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <path d="M2.4 60.7a50 50 0 0 0 36.9 36.9L2.4 60.7z" fill="currentColor"/>
    <path d="M.2 49.2a50 50 0 0 0 1.3 8.3L46.6 2.4A50 50 0 0 0 .2 49.2z" fill="currentColor"/>
    <path d="M97.6 39.3a50 50 0 0 0-36.9-36.9l36.9 36.9z" fill="currentColor"/>
    <path d="M99.8 50.8a50 50 0 0 0-1.3-8.3L53.4 97.6a50 50 0 0 0 46.4-46.8z" fill="currentColor"/>
  </svg>
);

export default function ActionsPanel() {
  const { state, send, userId } = useBoard();
  const [collapsed, setCollapsed] = useState(false);
  const [newText, setNewText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Linear ticket creation state
  const [linearActionId, setLinearActionId] = useState<string | null>(null);
  const [linearStep, setLinearStep] = useState<'team' | 'assignee' | 'creating' | 'done'>('team');
  const [createdTicket, setCreatedTicket] = useState<{ url: string; key: string } | null>(null);
  const [teams, setTeams] = useState<LinearTeam[]>([]);
  const [members, setMembers] = useState<LinearMember[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [selectedMemberName, setSelectedMemberName] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
  const [linearLoading, setLinearLoading] = useState(false);
  const [linearError, setLinearError] = useState('');

  // Previous actions from other team boards
  const [previousActions, setPreviousActions] = useState<PreviousAction[]>([]);
  const [showPrevious, setShowPrevious] = useState(false);
  const [loadingPrevious, setLoadingPrevious] = useState(false);
  const [carriedIds, setCarriedIds] = useState<Set<string>>(new Set());
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!state.teamId || !state.id) return;
    setLoadingPrevious(true);
    fetchPreviousActions(state.teamId, state.id)
      .then(setPreviousActions)
      .catch(() => {})
      .finally(() => setLoadingPrevious(false));
  }, [state.teamId, state.id]);

  // Get team context from cycle stats (if present)
  const statsTeamName = state.cycleStats?.teamName || '';

  const actions = Object.values(state.actions || {}).sort((a, b) => a.createdAt - b.createdAt);
  const userName = state.users[userId]?.name || 'Unknown';
  const linearAction = linearActionId ? state.actions?.[linearActionId] : null;

  const handleAdd = useCallback(() => {
    const text = newText.trim();
    if (!text) return;
    send('add_action', {
      text,
      done: false,
      authorId: userId,
      authorName: userName,
      createdAt: Date.now(),
    });
    setNewText('');
    inputRef.current?.focus();
  }, [newText, send, userId, userName]);

  const handleToggleDone = useCallback((id: string, done: boolean) => {
    send('update_action', { id, done: !done });
  }, [send]);

  const handleDelete = useCallback((id: string) => {
    send('delete_action', { id });
  }, [send]);

  const handleEditStart = useCallback((id: string, text: string) => {
    setEditingId(id);
    setEditText(text);
  }, []);

  const handleEditSave = useCallback(() => {
    if (editingId && editText.trim()) {
      send('update_action', { id: editingId, text: editText.trim() });
    }
    setEditingId(null);
    setEditText('');
  }, [editingId, editText, send]);

  const handleCarryForward = useCallback((prev: PreviousAction) => {
    send('add_action', {
      text: prev.text,
      done: false,
      authorId: userId,
      authorName: userName,
      createdAt: Date.now(),
    });
    setCarriedIds((ids) => new Set(ids).add(prev.id));
  }, [send, userId, userName]);

  const handlePreviousDone = useCallback(async (prev: PreviousAction) => {
    // Optimistically update UI
    setDoneIds((ids) => new Set(ids).add(prev.id));
    // Update source board's action in Supabase
    try {
      const { data } = await supabase
        .from('boards')
        .select('state')
        .eq('id', prev.sourceBoardId)
        .single();
      if (data?.state?.actions?.[prev.id]) {
        const updatedState = { ...data.state };
        updatedState.actions = { ...updatedState.actions, [prev.id]: { ...updatedState.actions[prev.id], done: true } };
        await supabase.from('boards').update({ state: updatedState }).eq('id', prev.sourceBoardId);
      }
    } catch {
      // Revert on failure
      setDoneIds((ids) => { const n = new Set(ids); n.delete(prev.id); return n; });
    }
  }, []);

  // Linear: open ticket creation modal
  const handleLinearOpen = useCallback(async (actionId: string) => {
    const apiKey = storage.read('linearApiKey');
    if (!apiKey) {
      setLinearError('Connect Linear first from the dashboard (From Linear button)');
      setLinearActionId(actionId);
      setLinearStep('team');
      return;
    }
    setLinearActionId(actionId);
    setLinearStep('team');
    setLinearError('');
    setLinearLoading(true);
    try {
      const t = await fetchTeams(apiKey);
      setTeams(t);
      // Auto-select team from cycle stats context
      if (statsTeamName) {
        const match = t.find((tm) => tm.name === statsTeamName);
        if (match) {
          setSelectedTeamId(match.id);
          const m = await fetchTeamMembers(apiKey, match.id);
          setMembers(m);
          setLinearStep('assignee');
        }
      }
    } catch (e) {
      setLinearError(e instanceof Error ? e.message : 'Failed to load teams');
    }
    setLinearLoading(false);
  }, [statsTeamName]);

  const handleTeamSelect = useCallback(async (teamId: string) => {
    const apiKey = storage.read('linearApiKey');
    if (!apiKey) return;
    setSelectedTeamId(teamId);
    setLinearLoading(true);
    setLinearError('');
    try {
      const m = await fetchTeamMembers(apiKey, teamId);
      setMembers(m);
      setLinearStep('assignee');
    } catch (e) {
      setLinearError(e instanceof Error ? e.message : 'Failed to load members');
    }
    setLinearLoading(false);
  }, []);

  const handleCreateTicket = useCallback(async () => {
    const apiKey = storage.read('linearApiKey');
    if (!apiKey || !selectedTeamId || !linearActionId) return;
    const action = state.actions?.[linearActionId];
    if (!action) return;
    setLinearStep('creating');
    setLinearError('');
    try {
      const result = await createIssue(apiKey, selectedTeamId, action.text, selectedMemberId || undefined);
      send('update_action', {
        id: linearActionId,
        linearUrl: result.url,
        linearKey: result.identifier,
      });
      setCreatedTicket({ url: result.url, key: result.identifier });
      setLinearStep('done');
    } catch (e) {
      setLinearError(e instanceof Error ? e.message : 'Failed to create ticket');
      setLinearStep('assignee');
    }
  }, [selectedTeamId, selectedMemberId, linearActionId, state.actions, send]);

  const handleLinearClose = useCallback(() => {
    setLinearActionId(null);
    setLinearStep('team');
    setLinearError('');
    setSelectedTeamId(null);
    setSelectedMemberId('');
    setSelectedMemberName('');
    setMemberSearch('');
    setMemberDropdownOpen(false);
    setMembers([]);
    setCreatedTicket(null);
  }, []);

  const hasLinearKey = !!storage.read('linearApiKey');

  return (
    <>
      <div className={`actions-panel ${collapsed ? 'collapsed' : ''}`}>
        <div className="actions-panel-header" onClick={() => setCollapsed(!collapsed)}>
          <span className="actions-panel-icon">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M2 4h12M2 8h12M2 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </span>
          <span className="actions-panel-title">Actions ({actions.length})</span>
          <span className="actions-panel-toggle">{collapsed ? '›' : '‹'}</span>
        </div>

        {!collapsed && (
          <div className="actions-panel-body">
            {/* Add new action */}
            <div className="actions-add-row">
              <input
                ref={inputRef}
                className="actions-add-input"
                placeholder="Add an action..."
                value={newText}
                onChange={(e) => setNewText(e.target.value.slice(0, 128))}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                maxLength={128}
              />
              <button
                className="actions-add-btn"
                disabled={!newText.trim()}
                onClick={handleAdd}
              >
                +
              </button>
            </div>

            {/* Action list */}
            <div className="actions-list">
              {actions.map((action) => (
                <div key={action.id} className={`actions-item ${action.done ? 'done' : ''}`}>
                  <div className="actions-item-top">
                    <button
                      className={`actions-check ${action.done ? 'checked' : ''}`}
                      onClick={() => handleToggleDone(action.id, action.done)}
                    >
                      {action.done ? '✓' : ''}
                    </button>

                    {editingId === action.id ? (
                      <input
                        className="actions-edit-input"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value.slice(0, 128))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEditSave();
                          if (e.key === 'Escape') { setEditingId(null); setEditText(''); }
                        }}
                        onBlur={handleEditSave}
                        maxLength={128}
                        autoFocus
                      />
                    ) : (
                      <span
                        className="actions-text"
                        onDoubleClick={() => handleEditStart(action.id, action.text)}
                      >
                        {action.text}
                      </span>
                    )}
                  </div>

                  <div className="actions-item-bottom">
                    <span className="actions-author">{action.authorName}</span>
                    <div className="actions-item-right">
                      {action.linearUrl ? (
                        <a
                          className="actions-linear-link"
                          href={action.linearUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title={action.linearKey || 'Open in Linear'}
                        >
                          {LINEAR_SVG(12)}
                          <span className="actions-linear-key">{action.linearKey}</span>
                        </a>
                      ) : hasLinearKey && (
                        <button
                          className="actions-linear-btn"
                          onClick={() => handleLinearOpen(action.id)}
                          title="Create Linear ticket"
                        >
                          {LINEAR_SVG(12)}
                        </button>
                      )}
                      <button
                        className="actions-delete-btn"
                        onClick={() => handleDelete(action.id)}
                        title="Delete action"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {actions.length === 0 && (
                <div className="actions-empty">No actions yet</div>
              )}
            </div>

            {/* Previous uncompleted actions from other team boards */}
            {state.teamId && (() => {
              const currentTexts = new Set(actions.map((a) => a.text.toLowerCase().trim()));
              const open = previousActions.filter(
                (p) => !currentTexts.has(p.text.toLowerCase().trim()) && !carriedIds.has(p.id) && !doneIds.has(p.id)
              );
              const carried = previousActions.filter((p) => carriedIds.has(p.id));
              const done = previousActions.filter((p) => doneIds.has(p.id));
              // Group open items by source board
              const grouped = new Map<string, PreviousAction[]>();
              for (const p of open) {
                const key = p.sourceSessionName;
                if (!grouped.has(key)) grouped.set(key, []);
                grouped.get(key)!.push(p);
              }

              if (open.length === 0 && carried.length === 0 && done.length === 0 && !loadingPrevious) return null;

              return (
                <div className="actions-previous">
                  <div
                    className="actions-previous-header"
                    onClick={() => setShowPrevious(!showPrevious)}
                  >
                    <span className="actions-previous-label">
                      Previous Actions ({open.length})
                    </span>
                    <span className={`actions-previous-chevron ${showPrevious ? 'open' : ''}`}>›</span>
                  </div>
                  {showPrevious && (
                    <div className="actions-previous-list">
                      {loadingPrevious ? (
                        <div className="actions-empty">Loading...</div>
                      ) : (
                        <>
                          {Array.from(grouped.entries()).map(([sessionName, items]) => (
                            <div key={sessionName} className="actions-previous-group">
                              <div className="actions-previous-board-name">{sessionName}</div>
                              {items.map((p) => (
                                <div key={p.id} className="actions-previous-item">
                                  <button
                                    className="actions-check"
                                    onClick={() => handlePreviousDone(p)}
                                    title="Mark as done"
                                  />
                                  <span className="actions-previous-text">{p.text}</span>
                                  <button
                                    className="actions-previous-carry-btn"
                                    onClick={() => handleCarryForward(p)}
                                    title="Carry forward to this board"
                                  >
                                    +
                                  </button>
                                </div>
                              ))}
                            </div>
                          ))}
                          {(carried.length > 0 || done.length > 0) && (
                            <div className="actions-previous-group">
                              {carried.map((p) => (
                                <div key={p.id} className="actions-previous-item carried">
                                  <span className="actions-previous-text">{p.text}</span>
                                  <span className="actions-previous-carry-btn carried" title="Carried forward">↑</span>
                                </div>
                              ))}
                              {done.map((p) => (
                                <div key={p.id} className="actions-previous-item done">
                                  <button className="actions-check checked" disabled>✓</button>
                                  <span className="actions-previous-text">{p.text}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {open.length === 0 && carried.length === 0 && done.length === 0 && (
                            <div className="actions-empty">No uncompleted actions from previous boards</div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Linear ticket creation modal — rendered as overlay outside the panel */}
      {linearActionId && (
        <div className="dash-modal-overlay" onClick={handleLinearClose}>
          <div className="linear-modal actions-linear-modal" onClick={(e) => e.stopPropagation()}>
            <button className="dash-modal-close" onClick={handleLinearClose}>✕</button>

            <div className="actions-linear-modal-header">
              <span className="actions-linear-modal-icon">{LINEAR_SVG(16)}</span>
              <span>Create Linear Ticket</span>
            </div>

            {linearAction && (
              <div className="actions-linear-modal-action">
                {linearAction.text}
              </div>
            )}

            {linearError && <div className="linear-error">{linearError}</div>}

            {linearStep === 'team' && (
              <div className="linear-step">
                {linearLoading ? (
                  <div className="dash-loading">
                    <div className="dash-loading-spinner" />
                    Loading teams...
                  </div>
                ) : (
                  <>
                    <div className="actions-linear-label">Select team</div>
                    <div className="linear-list">
                      {teams.map((t) => (
                        <div
                          key={t.id}
                          className={`linear-list-item ${selectedTeamId === t.id ? 'selected' : ''}`}
                          onClick={() => handleTeamSelect(t.id)}
                        >
                          <span className="linear-team-key">{t.key}</span>
                          <span className="linear-team-name">{t.name}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {linearStep === 'assignee' && (
              <div className="linear-step">
                {linearLoading ? (
                  <div className="dash-loading">
                    <div className="dash-loading-spinner" />
                    Loading members...
                  </div>
                ) : (
                  <>
                    <div className="actions-linear-label">Assign to (optional)</div>
                    <div className="member-picker">
                      <input
                        className="member-picker-input"
                        placeholder="Search by name..."
                        value={memberDropdownOpen ? memberSearch : selectedMemberName || memberSearch}
                        onChange={(e) => {
                          setMemberSearch(e.target.value);
                          setMemberDropdownOpen(true);
                          if (!e.target.value) {
                            setSelectedMemberId('');
                            setSelectedMemberName('');
                          }
                        }}
                        onFocus={() => setMemberDropdownOpen(true)}
                        autoFocus
                      />
                      {selectedMemberId && !memberDropdownOpen && (
                        <button
                          className="member-picker-clear"
                          onClick={() => { setSelectedMemberId(''); setSelectedMemberName(''); setMemberSearch(''); }}
                        >
                          ✕
                        </button>
                      )}
                      {memberDropdownOpen && (() => {
                        const q = memberSearch.toLowerCase();
                        const filtered = members.filter((m) =>
                          !q || (m.displayName || m.name).toLowerCase().includes(q)
                        );
                        return (
                          <div className="member-picker-dropdown">
                            <div
                              className={`member-picker-option ${!selectedMemberId ? 'selected' : ''}`}
                              onClick={() => {
                                setSelectedMemberId('');
                                setSelectedMemberName('');
                                setMemberSearch('');
                                setMemberDropdownOpen(false);
                              }}
                            >
                              <span className="member-picker-option-avatar">?</span>
                              Unassigned
                            </div>
                            {filtered.map((m) => (
                              <div
                                key={m.id}
                                className={`member-picker-option ${selectedMemberId === m.id ? 'selected' : ''}`}
                                onClick={() => {
                                  setSelectedMemberId(m.id);
                                  setSelectedMemberName(m.displayName || m.name);
                                  setMemberSearch('');
                                  setMemberDropdownOpen(false);
                                }}
                              >
                                <span className="member-picker-option-avatar">
                                  {(m.displayName || m.name).charAt(0).toUpperCase()}
                                </span>
                                {m.displayName || m.name}
                              </div>
                            ))}
                            {filtered.length === 0 && (
                              <div className="member-picker-empty">No matches</div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="actions-linear-modal-buttons">
                      <button
                        className="btn btn-secondary"
                        onClick={() => { setLinearStep('team'); setSelectedTeamId(null); setMembers([]); setMemberSearch(''); setMemberDropdownOpen(false); }}
                      >
                        Back
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={handleCreateTicket}
                      >
                        Create Ticket
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {linearStep === 'creating' && (
              <div className="dash-loading">
                <div className="dash-loading-spinner" />
                Creating ticket...
              </div>
            )}

            {linearStep === 'done' && createdTicket && (
              <div className="actions-linear-done">
                <div className="actions-linear-done-icon">✓</div>
                <div className="actions-linear-done-text">
                  Ticket <strong>{createdTicket.key}</strong> created successfully
                </div>
                <a
                  className="actions-linear-done-link"
                  href={createdTicket.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {LINEAR_SVG(14)}
                  Open {createdTicket.key} in Linear
                </a>
                <button className="btn btn-primary" onClick={handleLinearClose} style={{ marginTop: 8 }}>
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
