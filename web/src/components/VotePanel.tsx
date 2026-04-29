import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useBoard } from '../hooks/useBoard';
import { useVoteUI } from '../hooks/board/useVoteUI';
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
  const [allCastModal, setAllCastModal] = useState(false);
  const [takeTimeTip, setTakeTimeTip] = useState(false);
  const [everyoneDoneModal, setEveryoneDoneModal] = useState(false);
  const [tipRect, setTipRect] = useState<{ top: number; left: number } | null>(null);
  const doneBtnRef = useRef<HTMLButtonElement>(null);
  // Track prompts already shown for each vote id so we don't nag on unvote/re-vote.
  const allCastShownFor = useRef<string | null>(null);
  const everyoneDoneShownFor = useRef<string | null>(null);

  // Recompute the tooltip's anchor position whenever it's visible.
  useEffect(() => {
    if (!takeTimeTip) {
      setTipRect(null);
      return;
    }
    const update = () => {
      const el = doneBtnRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setTipRect({ top: r.top + r.height / 2, left: r.left - 14 });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [takeTimeTip]);

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

  const { myVoteCount } = useVoteUI(state, userId, viewingHistoryId, ranksVisible);
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

  const maxViewingVotes = viewingResults.length > 0 ? viewingResults[0].count : 1;

  // Notify board of which vote to show rank badges for (and visibility)
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('vote-view-change', { detail: viewingHistoryId }));
  }, [viewingHistoryId]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('vote-ranks-visibility', { detail: ranksVisible }));
  }, [ranksVisible]);

  // ── Prompts ──
  // When the current user has spent all their votes (and isn't already marked done),
  // show a modal asking if they're finished. Only fires once per vote session; we
  // won't nag them again if they unvote and re-vote.
  useEffect(() => {
    if (!vote || vote.closed) return;
    const isDoneNow = !!vote.doneUsers[userId];
    if (isDoneNow) return;
    const castAll = vote.votesPerUser > 0 && myVoteCount >= vote.votesPerUser;
    if (castAll && allCastShownFor.current !== vote.id) {
      allCastShownFor.current = vote.id;
      setAllCastModal(true);
    }
  }, [vote, myVoteCount, userId]);

  // When every connected user has clicked "I'm done voting", ask the organizer
  // if they're ready to reveal the results.
  useEffect(() => {
    if (!vote || vote.closed || !isOrganizer) return;
    const connected = Object.values(state.users).filter((u) => u.connected);
    if (connected.length === 0) return;
    const everyoneDone = connected.every((u) => vote.doneUsers[u.id]);
    if (everyoneDone && everyoneDoneShownFor.current !== vote.id) {
      everyoneDoneShownFor.current = vote.id;
      setEveryoneDoneModal(true);
    }
  }, [vote, state.users, isOrganizer]);

  // Reset per-vote prompt state when a new vote starts / current vote goes away.
  useEffect(() => {
    if (!vote || vote.closed) {
      setAllCastModal(false);
      setEveryoneDoneModal(false);
      setTakeTimeTip(false);
    }
  }, [vote?.id, vote?.closed]); // eslint-disable-line react-hooks/exhaustive-deps

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
            <div className="vote-done-wrap">
              <button
                ref={doneBtnRef}
                className="btn btn-primary btn-small"
                style={{ width: '100%' }}
                onClick={() => send('vote_done', {})}
              >
                I'm Done Voting
              </button>
            </div>
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

          {/* Live tally is intentionally hidden during active voting —
              totals are revealed only once the vote is closed. */}
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

      {/* Take-your-time tooltip, positioned next to the "I'm Done Voting" button
          via fixed coords so the vote-panel's overflow doesn't clip it. */}
      {takeTimeTip && tipRect && (
        <div
          className="vote-take-time-tip"
          role="dialog"
          style={{ top: tipRect.top, left: tipRect.left }}
        >
          <div className="vote-take-time-tip-arrow" />
          <div className="vote-take-time-tip-text">
            That's cool, take your time! You can click here once you're done.
          </div>
          <button
            className="btn btn-primary btn-small"
            style={{ width: '100%', marginTop: 8 }}
            onClick={() => setTakeTimeTip(false)}
          >
            Got it!
          </button>
        </div>
      )}

      {/* Modal: user cast all their votes */}
      {allCastModal && (
        <div className="vote-modal-overlay" onClick={() => setAllCastModal(false)}>
          <div className="vote-modal" onClick={(e) => e.stopPropagation()}>
            <div className="vote-modal-title">All votes cast</div>
            <div className="vote-modal-body">
              You've used all your votes. Are you done, or do you want another look?
            </div>
            <div className="vote-modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setAllCastModal(false);
                  setTakeTimeTip(true);
                }}
              >
                Nah, let me have another look
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  send('vote_done', {});
                  setAllCastModal(false);
                  setTakeTimeTip(false);
                }}
              >
                Yeah, I'm done!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: organizer sees every connected user marked done */}
      {everyoneDoneModal && (
        <div className="vote-modal-overlay" onClick={() => setEveryoneDoneModal(false)}>
          <div className="vote-modal" onClick={(e) => e.stopPropagation()}>
            <div className="vote-modal-title">Ready to reveal?</div>
            <div className="vote-modal-body">
              Seems like everyone is done voting, shall we reveal the results?
            </div>
            <div className="vote-modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setEveryoneDoneModal(false)}
              >
                Not yet
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  send('vote_close', {});
                  setEveryoneDoneModal(false);
                }}
              >
                Yes, reveal!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
