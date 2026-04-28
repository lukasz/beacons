/**
 * Test fixtures — typed sample data for use across tests. Add to this file
 * when a new shape is repeatedly needed; don't redefine fixtures locally.
 */
import type { BoardState, PostIt, Section, Group, User, VoteSession } from '../types';

export const fixtureUser = (overrides: Partial<User> = {}): User => ({
  id: 'u1',
  name: 'Ana',
  connected: true,
  hideMode: false,
  ...overrides,
});

export const fixtureSection = (overrides: Partial<Section> = {}): Section => ({
  id: 's1',
  title: 'What went well',
  colorIdx: 3,
  x: 0,
  y: 0,
  w: 400,
  h: 300,
  order: 0,
  ...overrides,
});

export const fixturePostIt = (overrides: Partial<PostIt> = {}): PostIt => ({
  id: 'p1',
  sectionId: 's1',
  authorId: 'u1',
  text: 'hello',
  x: 0,
  y: 0,
  hidden: false,
  votes: 0,
  colorIdx: 0,
  ...overrides,
});

export const fixtureGroup = (overrides: Partial<Group> = {}): Group => ({
  id: 'g1',
  label: 'cluster',
  x: 0,
  y: 0,
  w: 80,
  h: 30,
  ...overrides,
});

export const fixtureVote = (overrides: Partial<VoteSession> = {}): VoteSession => ({
  id: 'v1',
  organizerId: 'u1',
  votesPerUser: 3,
  votes: {},
  doneUsers: {},
  closed: false,
  ...overrides,
});

export const fixtureBoardState = (overrides: Partial<BoardState> = {}): BoardState => ({
  id: 'b1',
  sections: {},
  postIts: {},
  groups: {},
  images: {},
  timer: { durationSec: 300, remainingSec: 300, running: false },
  voteHistory: [],
  users: {},
  actions: {},
  sessionName: '',
  teamName: '',
  beatGoal: '',
  beatGoalHit: null,
  ...overrides,
});
