/**
 * Voting derivations shared by `<Board>` and `<VotePanel>`.
 *
 * Pure: no refs, no side effects, no event-bus subscriptions. Caller
 * passes the derivation inputs (state, userId, currently-viewed
 * history vote id, whether rank labels are visible) and gets back
 * memoised values.
 *
 * Components own:
 *   - The vote handlers themselves (they need `send`).
 *   - The `viewingHistoryId` / `ranksVisible` UI state (will move to
 *     BoardUiContext in Phase 4).
 */
import { useCallback, useMemo } from 'react';
import type { BoardState, VoteSession } from '../../types';

export interface VoteUI {
  /** The active vote (open or closed), or undefined when none has run. */
  vote: VoteSession | undefined;
  /** A vote is currently open. */
  votingActive: boolean;
  /** This user is allowed to cast more votes (not done, vote open). */
  canVote: boolean;
  /** This user's total cast votes across all targets. */
  myVoteCount: number;
  /** True when the user can still cast at least one more vote. */
  hasRemainingVotes: boolean;
  /** The vote whose results drive the rank-badge map (closed or history). */
  rankVote: VoteSession | null;
  /** Map of `targetId → rank` (1-based, top vote = 1). Empty when no rank is shown. */
  rankMap: Record<string, number>;

  /** Map a post-it id to the id we vote on (the group, if grouped). */
  getVoteTarget: (postItId: string) => string;
  /**
   * The badge count to render. While the vote is open, this is the
   * caller's *own* votes for that target only — totals are not revealed
   * mid-vote. After close, the full count.
   */
  getVoteCount: (targetId: string) => number;
  /** As above, but for a post-it (follows its group when grouped). */
  getEffectiveVoteCount: (postItId: string) => number;
  /** Rank for a post-it (follows its group when grouped). 0 means unranked. */
  getEffectiveRank: (postItId: string) => number;
}

export function useVoteUI(
  state: BoardState,
  userId: string,
  viewingHistoryId: string | null = null,
  ranksVisible: boolean = true,
): VoteUI {
  const vote = state.vote;
  const votingActive = !!vote && !vote.closed;
  const canVote = !!vote && !vote.closed && !vote.doneUsers[userId];

  const myVoteCount = useMemo(() => {
    if (!vote) return 0;
    let count = 0;
    for (const voters of Object.values(vote.votes)) {
      for (const v of voters) if (v === userId) count++;
    }
    return count;
  }, [vote, userId]);

  const hasRemainingVotes = vote ? myVoteCount < vote.votesPerUser : false;

  const getVoteTarget = useCallback(
    (postItId: string) => state.postIts[postItId]?.groupId ?? postItId,
    [state.postIts],
  );

  const getVoteCount = useCallback(
    (targetId: string) => {
      if (!vote) return 0;
      const voters = vote.votes[targetId];
      if (!voters) return 0;
      // During active voting, each user only sees their OWN votes per
      // target. The aggregate tally is revealed only after the vote is
      // closed.
      if (!vote.closed) {
        let own = 0;
        for (const v of voters) if (v === userId) own++;
        return own;
      }
      return voters.length;
    },
    [vote, userId],
  );

  const getEffectiveVoteCount = useCallback(
    (postItId: string) => {
      const p = state.postIts[postItId];
      if (p?.groupId) return getVoteCount(p.groupId);
      return getVoteCount(postItId);
    },
    [state.postIts, getVoteCount],
  );

  const rankVote = useMemo((): VoteSession | null => {
    if (viewingHistoryId) {
      return (state.voteHistory || []).find((v) => v.id === viewingHistoryId) || null;
    }
    return vote?.closed ? vote : null;
  }, [viewingHistoryId, state.voteHistory, vote]);

  const rankMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (!rankVote || !ranksVisible) return map;
    const items: { id: string; count: number }[] = [];
    for (const [targetId, voters] of Object.entries(rankVote.votes)) {
      if (voters.length > 0) items.push({ id: targetId, count: voters.length });
    }
    items.sort((a, b) => b.count - a.count);
    for (let i = 0; i < items.length; i++) map[items[i].id] = i + 1;
    return map;
  }, [rankVote, ranksVisible]);

  const getEffectiveRank = useCallback(
    (postItId: string) => {
      const p = state.postIts[postItId];
      if (p?.groupId) return rankMap[p.groupId] || 0;
      return rankMap[postItId] || 0;
    },
    [state.postIts, rankMap],
  );

  return {
    vote,
    votingActive,
    canVote,
    myVoteCount,
    hasRemainingVotes,
    rankVote,
    rankMap,
    getVoteTarget,
    getVoteCount,
    getEffectiveVoteCount,
    getEffectiveRank,
  };
}
