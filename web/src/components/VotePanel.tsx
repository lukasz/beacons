import { useMemo, useState, useEffect, useCallback } from 'react';
import { useBoard } from '../hooks/useBoard';
import type { VoteSession } from '../types';

function getWinnerLabel(vote: VoteSession, groups: Record<string, { label: string }>, postIts: Record<string, { text: string }>) {
  let best = '';
  let max = 0;
  for (const [targetId, voters] of Object.entries(vote.votes)) {
    if (voters.length > max) {
      max = voters.length;
      const g = groups[targetId];
      const p = postIts[targetId];
      best = g?.label || p?.text?.slice(0, 25) || targetId;
    }
  }
  return best || 'No votes';
}

interface NumberStepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}

function NumberStepper({ value, min = 1, max = 20, onChange }: NumberStepperProps) {
  return (
    <div className="number-stepper">
      <button
        className="number-stepper-btn"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
      >
        −
      </button>
      <span className="number-stepper-value">{value}</span>
      <button
        className="number-stepper-btn"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
      >
        +
      </button>
    </div>
  );
}

export default function VotePanel() {
  const { state, send, userId } = useBoard();
  const { vote, voteHistory } = state;
  const [open, _setOpen] = useState(false);
  const setOpen = useCallback((v: boolean | ((prev: boolean) => boolean)) => {
    _setOpen((prev) => {
      const next = typeof v === 'function' ? v(prev) : v;
      window.dispatchEvent(new CustomEvent('vote-panel-visibility', { detail: next }));
      return next;
    });
  }, []);
  const [showVoteConfig, setShowVoteConfig] = useState(false);
  const [votesPerUser, setVotesPerUser] = useState(3);
  const [viewingHistoryId, setViewingHistoryId] = useState<string | null>(null);
  const [ranksVisible, setRanksVisible] = useState(true);

  // Auto-open when a vote starts or results come in
  useEffect(() => {
    if (vote && !vote.closed) setOpen(true);
  }, [vote?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (vote?.closed) setOpen(true);
  }, [vote?.closed]);

  // Toggle from toolbar
  useEffect(() => {
    const handler = () => setOpen((o) => !o);
    window.addEventListener('toggle-vote-panel', handler);
    return () => window.removeEventListener('toggle-vote-panel', handler);
  }, []);

  const isOrganizer = vote?.organizerId === userId;
  const isDone = vote?.doneUsers[userId] || false;

  const viewingVote = useMemo(() => {
    if (viewingHistoryId) {
      return voteHistory.find((v) => v.id === viewingHistoryId) || null;
    }
    return vote?.closed ? vote : null;
  }, [viewingHistoryId, voteHistory, vote]);

  const myVoteCount = useMemo(() => {
    if (!vote || vote.closed) return 0;
    let count = 0;
    for (const voters of Object.values(vote.votes)) {
      for (const v of voters) {
        if (v === userId) count++;
      }
    }
    return count;
  }, [vote, userId]);

  const remaining = vote && !vote.closed ? vote.votesPerUser - myVoteCount : 0;

  const getResults = useCallback(
    (v: VoteSession) => {
      const items: { targetId: string; label: string; count: number }[] = [];
      for (const [targetId, voters] of Object.entries(v.votes)) {
        if (voters.length === 0) continue;
        const group = state.groups[targetId];
        const postIt = state.postIts[targetId];
        const label = group?.label || postIt?.text?.slice(0, 40) || targetId;
        items.push({ targetId, label, count: voters.length });
      }
      items.sort((a, b) => b.count - a.count);
      return items;
    },
    [state.groups, state.postIts],
  );

  const viewingResults = useMemo(() => {
    if (!viewingVote) return [];
    return getResults(viewingVote);
  }, [viewingVote, getResults]);

  const activeResults = useMemo(() => {
    if (!vote || vote.closed) return [];
    return getResults(vote);
  }, [vote, getResults]);

  const maxViewingVotes = viewingResults.length > 0 ? viewingResults[0].count : 1;
  const maxActiveVotes = activeResults.length > 0 ? activeResults[0].count : 1;

  // Notify board of which vote to show rank badges for (and visibility)
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('vote-view-change', { detail: viewingHistoryId }));
  }, [viewingHistoryId]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('vote-ranks-visibility', { detail: ranksVisible }));
  }, [ranksVisible]);

  if (!open) return null;

  const votingActive = !!vote && !vote.closed;
  const hasClosedVote = vote?.closed;
  const noVoteYet = !vote;
  const showStartButton = noVoteYet || hasClosedVote;

  const users = Object.values(state.users).filter((u) => u.connected);

  return (
    <div className="vote-panel">
      <div className="vote-panel-header">
        <span className="vote-panel-title">Voting</span>
        <button
          className="vote-panel-close"
          onClick={() => { setOpen(false); setViewingHistoryId(null); }}
        >
          ×
        </button>
      </div>

      {/* Start new vote */}
      {showStartButton && !showVoteConfig && (
        <button
          className="btn btn-primary btn-small"
          onClick={() => setShowVoteConfig(true)}
          style={{ width: '100%' }}
        >
          Start New Vote
        </button>
      )}

      {/* Vote config */}
      {showVoteConfig && (
        <div className="vote-config">
          <label className="vote-config-label">Votes per person</label>
          <NumberStepper value={votesPerUser} min={1} max={20} onChange={setVotesPerUser} />
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button className="btn btn-secondary btn-small" style={{ flex: 1 }} onClick={() => setShowVoteConfig(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary btn-small"
              style={{ flex: 1 }}
              onClick={() => {
                send('vote_start', { votesPerUser });
                setShowVoteConfig(false);
                setViewingHistoryId(null);
              }}
            >
              Start
            </button>
          </div>
        </div>
      )}

      {/* Active voting */}
      {votingActive && !viewingHistoryId && (
        <>
          <div className="vote-remaining">
            {remaining} vote{remaining !== 1 ? 's' : ''} remaining
          </div>

          {!isDone ? (
            <button className="btn btn-primary btn-small" style={{ width: '100%' }} onClick={() => send('vote_done', {})}>
              I'm Done Voting
            </button>
          ) : (
            <div style={{ fontSize: '0.85rem', color: 'var(--color-3)', textAlign: 'center' }}>You're done!</div>
          )}

          {isOrganizer && (
            <>
              <div className="vote-section-label">Status</div>
              {users.map((u) => (
                <div key={u.id} className="vote-user-status">
                  <span className={`dot ${vote.doneUsers[u.id] ? 'done' : 'pending'}`} />
                  <span>{u.name}</span>
                </div>
              ))}
              <button
                className="btn btn-danger btn-small"
                onClick={() => send('vote_close', {})}
                style={{ width: '100%', marginTop: 4 }}
              >
                Close Vote
              </button>
            </>
          )}

          {activeResults.length > 0 && (
            <>
              <div className="vote-section-label">Current Tally</div>
              {activeResults.map((r) => (
                <div key={r.targetId} className="vote-result-item">
                  <div style={{ flex: 1 }}>
                    <div className="vote-result-label">{r.label}</div>
                    <div
                      className="vote-result-bar"
                      style={{ width: `${(r.count / maxActiveVotes) * 100}%` }}
                    />
                  </div>
                  <span className="vote-result-count">{r.count}</span>
                </div>
              ))}
            </>
          )}
        </>
      )}

      {/* Viewing results */}
      {viewingVote && (
        <>
          <div className="vote-section-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{viewingHistoryId ? 'Past Vote Results' : 'Vote Results'}</span>
            <button
              className={`rank-toggle-btn ${ranksVisible ? 'active' : ''}`}
              onClick={() => setRanksVisible(!ranksVisible)}
              title={ranksVisible ? 'Hide rank labels' : 'Show rank labels'}
            >
              {ranksVisible ? '🏆' : '🏆'}
            </button>
          </div>
          {viewingResults.map((r) => (
            <div key={r.targetId} className="vote-result-item">
              <div style={{ flex: 1 }}>
                <div className="vote-result-label">{r.label}</div>
                <div
                  className="vote-result-bar"
                  style={{ width: `${(r.count / maxViewingVotes) * 100}%` }}
                />
              </div>
              <span className="vote-result-count">{r.count}</span>
            </div>
          ))}
          {hasClosedVote && !viewingHistoryId && (
            <button
              className="btn btn-secondary btn-small"
              onClick={() => send('vote_dismiss', {})}
              style={{ width: '100%', marginTop: 4 }}
            >
              Dismiss
            </button>
          )}
          {viewingHistoryId && (
            <button
              className="btn btn-secondary btn-small"
              onClick={() => setViewingHistoryId(null)}
              style={{ width: '100%', marginTop: 4 }}
            >
              Back
            </button>
          )}
        </>
      )}

      {/* Vote history */}
      {voteHistory.length > 0 && (
        <div className="vote-history-section">
          <div className="vote-section-label">Previous Votes</div>
          {voteHistory.map((v, i) => {
            const winner = getWinnerLabel(v, state.groups, state.postIts);
            const isActive = viewingHistoryId === v.id;
            return (
              <div
                key={v.id}
                className={`vote-history-item ${isActive ? 'active' : ''}`}
                onClick={() => setViewingHistoryId(isActive ? null : v.id)}
              >
                <span className="vote-history-index">#{i + 1}</span>
                <span className="vote-history-winner">{winner}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
