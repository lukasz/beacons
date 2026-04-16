export const COLORS = [
  '#F87171', // red
  '#FB923C', // orange
  '#FBBF24', // amber
  '#4ADE80', // green
  '#22D3EE', // cyan
  '#60A5FA', // blue
  '#A78BFA', // violet
  '#F472B6', // pink
] as const;

export const POSTIT_COLORS = [
  '#FCA5A5', // red light
  '#FDBA74', // orange light
  '#FDE68A', // amber light
  '#86EFAC', // green light
  '#67E8F9', // cyan light
  '#93C5FD', // blue light
  '#C4B5FD', // violet light
  '#F9A8D4', // pink light
] as const;

export interface Section {
  id: string;
  title: string;
  colorIdx: number;
  x: number;
  y: number;
  w: number;
  h: number;
  order: number;
}

export interface PostIt {
  id: string;
  sectionId: string;
  authorId: string;
  text: string;
  x: number;
  y: number;
  hidden: boolean;
  groupId?: string;
  votes: number;
  colorIdx?: number;
}

export interface Group {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TimerState {
  durationSec: number;
  remainingSec: number;
  running: boolean;
  startedAt?: number;
  open?: boolean;
}

export interface VoteSession {
  id: string;
  organizerId: string;
  votesPerUser: number;
  votes: Record<string, string[]>;
  doneUsers: Record<string, boolean>;
  closed: boolean;
}

export interface User {
  id: string;
  name: string;
  connected: boolean;
  hideMode: boolean;
}

export interface SessionMeta {
  sessionName: string;
  teamName: string;
  beatGoal: string;
  beatGoalHit: boolean | null;
}

export interface CycleStats {
  cycleName: string;
  teamName: string;
  dateRange: string;
  progress: number;
  totalIssues: number;
  completedIssues: number;
  canceledIssues: number;
  inProgressIssues: number;
  notStartedIssues: number;
  totalPoints: number;
  donePoints: number;
  assignees: { name: string; completed: number; total: number }[];
  owner?: string;
  health?: string | null;
  source: 'cycle' | 'project';
  linearUrl?: string;
  // Scope stats (from Linear cycle scopeHistory)
  scopeStart?: number;
  scopeCurrent?: number;
  scopeCompleted?: number;
  // Capacity (sum of estimates at cycle start vs current)
  capacityPoints?: number;
}

export interface ActionItem {
  id: string;
  text: string;
  done: boolean;
  authorId: string;
  authorName: string;
  linearUrl?: string;
  linearKey?: string;
  createdAt: number;
}

export interface ImageElement {
  id: string;
  url: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BoardState {
  id: string;
  sections: Record<string, Section>;
  postIts: Record<string, PostIt>;
  groups: Record<string, Group>;
  images: Record<string, ImageElement>;
  timer: TimerState;
  vote?: VoteSession;
  voteHistory: VoteSession[];
  users: Record<string, User>;
  actions: Record<string, ActionItem>;
  sessionName: string;
  teamName: string;
  beatGoal: string;
  beatGoalHit: boolean | null;
  cycleStats?: CycleStats;
  teamId?: string;
  accessMode?: 'org' | 'public';
}

export interface Team {
  id: string;
  name: string;
  linearTeamId?: string;
  linearTeamKey?: string;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
  memberCount?: number;
}

export interface WSMessage {
  type: string;
  payload: unknown;
}
