import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useVoteUI } from './useVoteUI';
import {
  fixtureBoardState,
  fixturePostIt,
  fixtureGroup,
  fixtureVote,
} from '../../test/fixtures';

const baseUserId = 'u1';

describe('useVoteUI — derivations without a vote', () => {
  it('reports an inert state', () => {
    const { result } = renderHook(() => useVoteUI(fixtureBoardState(), baseUserId));
    expect(result.current.vote).toBeUndefined();
    expect(result.current.votingActive).toBe(false);
    expect(result.current.canVote).toBe(false);
    expect(result.current.myVoteCount).toBe(0);
    expect(result.current.hasRemainingVotes).toBe(false);
    expect(result.current.rankMap).toEqual({});
    expect(result.current.getVoteCount('p1')).toBe(0);
  });
});

describe('useVoteUI — open vote', () => {
  const state = fixtureBoardState({
    postIts: {
      p1: fixturePostIt({ id: 'p1' }),
      p2: fixturePostIt({ id: 'p2', groupId: 'g1' }),
    },
    groups: { g1: fixtureGroup({ id: 'g1' }) },
    vote: fixtureVote({
      votesPerUser: 3,
      // u1 has 2 votes total: 1 on p1, 1 on g1.
      votes: { p1: ['u1', 'u2'], g1: ['u1', 'u3', 'u3'] },
      doneUsers: {},
      closed: false,
    }),
  });

  it('counts only the user own votes during an open vote', () => {
    const { result } = renderHook(() => useVoteUI(state, baseUserId));
    expect(result.current.votingActive).toBe(true);
    expect(result.current.canVote).toBe(true);
    expect(result.current.myVoteCount).toBe(2);
    expect(result.current.hasRemainingVotes).toBe(true);
  });

  it('hides others votes — getVoteCount returns only the caller own', () => {
    const { result } = renderHook(() => useVoteUI(state, baseUserId));
    // p1 has [u1, u2]; the user only sees their own (1).
    expect(result.current.getVoteCount('p1')).toBe(1);
    // g1 has [u1, u3, u3]; the user only sees 1.
    expect(result.current.getVoteCount('g1')).toBe(1);
  });

  it('getEffectiveVoteCount follows group membership', () => {
    const { result } = renderHook(() => useVoteUI(state, baseUserId));
    // p2 belongs to g1, so its effective count is g1 (1 own).
    expect(result.current.getEffectiveVoteCount('p2')).toBe(1);
    expect(result.current.getEffectiveVoteCount('p1')).toBe(1);
  });

  it('getVoteTarget returns groupId when the post-it is grouped', () => {
    const { result } = renderHook(() => useVoteUI(state, baseUserId));
    expect(result.current.getVoteTarget('p1')).toBe('p1');
    expect(result.current.getVoteTarget('p2')).toBe('g1');
  });

  it('does not produce ranks while the vote is open', () => {
    const { result } = renderHook(() => useVoteUI(state, baseUserId));
    expect(result.current.rankVote).toBeNull();
    expect(result.current.rankMap).toEqual({});
    expect(result.current.getEffectiveRank('p1')).toBe(0);
  });

  it('canVote becomes false once the user marks themselves done', () => {
    const stateDone = fixtureBoardState({
      ...state,
      vote: fixtureVote({ ...state.vote!, doneUsers: { u1: true } }),
    });
    const { result } = renderHook(() => useVoteUI(stateDone, baseUserId));
    expect(result.current.canVote).toBe(false);
  });
});

describe('useVoteUI — closed vote', () => {
  const state = fixtureBoardState({
    postIts: {
      p1: fixturePostIt({ id: 'p1', text: 'Alpha' }),
      p2: fixturePostIt({ id: 'p2', text: 'Beta' }),
      p3: fixturePostIt({ id: 'p3', groupId: 'g1' }),
    },
    groups: { g1: fixtureGroup({ id: 'g1', label: 'cluster' }) },
    vote: fixtureVote({
      closed: true,
      votes: { p1: ['u1', 'u2', 'u3'], p2: ['u1'], g1: ['u1', 'u2'] },
    }),
  });

  it('reveals total counts on closed votes', () => {
    const { result } = renderHook(() => useVoteUI(state, baseUserId));
    expect(result.current.votingActive).toBe(false);
    expect(result.current.canVote).toBe(false);
    expect(result.current.getVoteCount('p1')).toBe(3);
    expect(result.current.getVoteCount('p2')).toBe(1);
    expect(result.current.getVoteCount('g1')).toBe(2);
  });

  it('produces a rank map ordered by vote count', () => {
    const { result } = renderHook(() => useVoteUI(state, baseUserId));
    expect(result.current.rankMap).toEqual({ p1: 1, g1: 2, p2: 3 });
    expect(result.current.getEffectiveRank('p1')).toBe(1);
    // p3 belongs to g1, so its rank follows.
    expect(result.current.getEffectiveRank('p3')).toBe(2);
    expect(result.current.getEffectiveRank('p2')).toBe(3);
  });

  it('returns an empty rank map when ranks are hidden', () => {
    const { result } = renderHook(() => useVoteUI(state, baseUserId, null, false));
    expect(result.current.rankMap).toEqual({});
    expect(result.current.getEffectiveRank('p1')).toBe(0);
  });

  it('viewingHistoryId picks the matching history vote for ranking', () => {
    const historyVote = fixtureVote({
      id: 'old',
      closed: true,
      votes: { p2: ['u1', 'u2', 'u3'], p1: ['u1'] },
    });
    const stateWithHistory = fixtureBoardState({ ...state, voteHistory: [historyVote] });
    const { result } = renderHook(() => useVoteUI(stateWithHistory, baseUserId, 'old'));
    expect(result.current.rankVote?.id).toBe('old');
    expect(result.current.rankMap).toEqual({ p2: 1, p1: 2 });
  });
});
