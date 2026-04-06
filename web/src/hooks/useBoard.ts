import { createContext, useContext, useReducer, useCallback } from 'react';
import type { BoardState, Section, PostIt, Group, TimerState, VoteSession, User, SessionMeta, ActionItem, ImageElement } from '../types';

const emptyBoard: BoardState = {
  id: '',
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
};

type Action =
  | { type: 'sync'; payload: BoardState }
  | { type: 'user_joined'; payload: User }
  | { type: 'user_left'; payload: { userId: string } }
  | { type: 'add_section'; payload: Section }
  | { type: 'update_section'; payload: Section }
  | { type: 'delete_section'; payload: { id: string } }
  | { type: 'add_postit'; payload: PostIt }
  | { type: 'update_postit'; payload: PostIt }
  | { type: 'move_postit'; payload: PostIt }
  | { type: 'delete_postit'; payload: { id: string } }
  | { type: 'toggle_hide'; payload: { userId: string; hidden: boolean } }
  | { type: 'add_group'; payload: Group }
  | { type: 'update_group'; payload: Group }
  | { type: 'delete_group'; payload: { id: string } }
  | { type: 'timer_set'; payload: TimerState }
  | { type: 'timer_adjust'; payload: TimerState }
  | { type: 'timer_start'; payload: TimerState }
  | { type: 'timer_pause'; payload: TimerState }
  | { type: 'timer_reset'; payload: TimerState }
  | { type: 'timer_tick'; payload: TimerState }
  | { type: 'vote_update'; payload: VoteSession }
  | { type: 'vote_dismiss'; payload: VoteSession[] }
  | { type: 'vote_history'; payload: VoteSession[] }
  | { type: 'update_meta'; payload: SessionMeta }
  | { type: 'add_action'; payload: ActionItem }
  | { type: 'update_action'; payload: ActionItem }
  | { type: 'delete_action'; payload: { id: string } }
  | { type: 'add_image'; payload: ImageElement }
  | { type: 'move_image'; payload: ImageElement }
  | { type: 'delete_image'; payload: { id: string } }
  | { type: 'update_access'; payload: { accessMode: 'org' | 'public' } };

function boardReducer(state: BoardState, action: Action): BoardState {
  switch (action.type) {
    case 'sync':
      return {
        ...action.payload,
        voteHistory: action.payload.voteHistory || [],
        actions: action.payload.actions || {},
        images: action.payload.images || {},
        sessionName: action.payload.sessionName || '',
        teamName: action.payload.teamName || '',
        beatGoal: action.payload.beatGoal || '',
        beatGoalHit: action.payload.beatGoalHit ?? null,
        teamId: action.payload.teamId || '',
      };

    case 'user_joined':
      return { ...state, users: { ...state.users, [action.payload.id]: action.payload } };

    case 'user_left': {
      const users = { ...state.users };
      if (users[action.payload.userId]) {
        users[action.payload.userId] = { ...users[action.payload.userId], connected: false };
      }
      return { ...state, users };
    }

    case 'add_section':
    case 'update_section':
      return { ...state, sections: { ...state.sections, [action.payload.id]: action.payload } };

    case 'delete_section': {
      const sections = { ...state.sections };
      delete sections[action.payload.id];
      return { ...state, sections };
    }

    case 'add_postit':
    case 'update_postit':
    case 'move_postit':
      return { ...state, postIts: { ...state.postIts, [action.payload.id]: action.payload } };

    case 'delete_postit': {
      const postIts = { ...state.postIts };
      delete postIts[action.payload.id];
      return { ...state, postIts };
    }

    case 'toggle_hide': {
      const postIts = { ...state.postIts };
      for (const [id, p] of Object.entries(postIts)) {
        if (p.authorId === action.payload.userId) {
          postIts[id] = { ...p, hidden: action.payload.hidden };
        }
      }
      const users = { ...state.users };
      if (users[action.payload.userId]) {
        users[action.payload.userId] = { ...users[action.payload.userId], hideMode: action.payload.hidden };
      }
      return { ...state, postIts, users };
    }

    case 'add_group':
    case 'update_group':
      return { ...state, groups: { ...state.groups, [action.payload.id]: action.payload } };

    case 'delete_group': {
      const groups = { ...state.groups };
      delete groups[action.payload.id];
      return { ...state, groups };
    }

    case 'timer_set':
    case 'timer_adjust':
    case 'timer_start':
    case 'timer_pause':
    case 'timer_reset':
    case 'timer_tick':
      return { ...state, timer: action.payload };

    case 'vote_update':
      return { ...state, vote: action.payload };

    case 'vote_dismiss':
      return { ...state, vote: undefined, voteHistory: Array.isArray(action.payload) ? action.payload : [] };

    case 'vote_history':
      return { ...state, voteHistory: Array.isArray(action.payload) ? action.payload : [] };

    case 'update_meta':
      return {
        ...state,
        sessionName: action.payload.sessionName ?? state.sessionName,
        teamName: action.payload.teamName ?? state.teamName,
        beatGoal: action.payload.beatGoal ?? state.beatGoal,
        beatGoalHit: action.payload.beatGoalHit,
      };

    case 'add_action':
    case 'update_action':
      return { ...state, actions: { ...state.actions, [action.payload.id]: action.payload } };

    case 'delete_action': {
      const actions = { ...state.actions };
      delete actions[action.payload.id];
      return { ...state, actions };
    }

    case 'add_image':
    case 'move_image':
      return { ...state, images: { ...state.images, [action.payload.id]: action.payload } };

    case 'delete_image': {
      const images = { ...state.images };
      delete images[action.payload.id];
      return { ...state, images };
    }

    case 'update_access':
      return { ...state, accessMode: action.payload.accessMode };

    default:
      return state;
  }
}

export interface BoardContextValue {
  state: BoardState;
  dispatch: React.Dispatch<Action>;
  send: (type: string, payload: unknown) => void;
  userId: string;
  onLeave?: () => void;
  templateMode?: boolean;
  isGuest?: boolean;
}

export const BoardContext = createContext<BoardContextValue>(null!);

export function useBoard() {
  return useContext(BoardContext);
}

export function useBoardReducer() {
  return useReducer(boardReducer, emptyBoard);
}

export function useBoardMessageHandler(dispatch: React.Dispatch<Action>) {
  return useCallback(
    (type: string, payload: unknown) => {
      dispatch({ type, payload } as Action);
    },
    [dispatch],
  );
}
