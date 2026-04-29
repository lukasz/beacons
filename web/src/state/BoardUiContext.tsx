/**
 * UI-only state shared between the various board panels and the main
 * Board component. Replaces the `window.dispatchEvent(new CustomEvent(...))`
 * pattern that previously coupled VotePanel, Toolbar, FloatingMenu, and
 * Board through string-typed events.
 *
 * Mounted by `<Board>`; consumed by anything inside it.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { storage } from '../lib/storage';

interface BoardUiState {
  /** Is the right-side vote panel open? */
  votePanelOpen: boolean;
  /** Id of the historical vote currently being viewed in the panel, or null. */
  viewingHistoryId: string | null;
  /** Should rank-medal labels render on cards? */
  ranksVisible: boolean;
  /** Should remote cursors render? Persisted to storage. */
  cursorsEnabled: boolean;
}

interface BoardUiActions {
  setVotePanelOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  toggleVotePanel: () => void;
  setViewingHistoryId: (id: string | null) => void;
  setRanksVisible: (v: boolean | ((prev: boolean) => boolean)) => void;
  /** Flip cursor visibility and persist the choice. */
  setCursorsEnabled: (v: boolean) => void;
}

export type BoardUiContextValue = BoardUiState & BoardUiActions;

const BoardUiContext = createContext<BoardUiContextValue | null>(null);

export function BoardUiProvider({ children }: { children: ReactNode }) {
  const [votePanelOpen, setVotePanelOpenState] = useState(false);
  const [viewingHistoryId, setViewingHistoryIdState] = useState<string | null>(null);
  const [ranksVisible, setRanksVisibleState] = useState(true);
  const [cursorsEnabled, setCursorsEnabledState] = useState(
    () => storage.read('cursors') !== 'off',
  );

  const setVotePanelOpen = useCallback<BoardUiActions['setVotePanelOpen']>((next) => {
    setVotePanelOpenState((prev) => (typeof next === 'function' ? next(prev) : next));
  }, []);

  const toggleVotePanel = useCallback(() => {
    setVotePanelOpenState((prev) => !prev);
  }, []);

  const setViewingHistoryId = useCallback<BoardUiActions['setViewingHistoryId']>((id) => {
    setViewingHistoryIdState(id);
  }, []);

  const setRanksVisible = useCallback<BoardUiActions['setRanksVisible']>((next) => {
    setRanksVisibleState((prev) => (typeof next === 'function' ? next(prev) : next));
  }, []);

  const setCursorsEnabled = useCallback<BoardUiActions['setCursorsEnabled']>((next) => {
    setCursorsEnabledState(next);
    storage.write('cursors', next ? 'on' : 'off');
  }, []);

  const value = useMemo<BoardUiContextValue>(() => ({
    votePanelOpen,
    viewingHistoryId,
    ranksVisible,
    cursorsEnabled,
    setVotePanelOpen,
    toggleVotePanel,
    setViewingHistoryId,
    setRanksVisible,
    setCursorsEnabled,
  }), [
    votePanelOpen, viewingHistoryId, ranksVisible, cursorsEnabled,
    setVotePanelOpen, toggleVotePanel, setViewingHistoryId, setRanksVisible, setCursorsEnabled,
  ]);

  return <BoardUiContext.Provider value={value}>{children}</BoardUiContext.Provider>;
}

export function useBoardUi(): BoardUiContextValue {
  const ctx = useContext(BoardUiContext);
  if (!ctx) {
    throw new Error('useBoardUi must be used inside a <BoardUiProvider>');
  }
  return ctx;
}
