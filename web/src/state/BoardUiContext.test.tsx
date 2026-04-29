import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { BoardUiProvider, useBoardUi } from './BoardUiContext';
import { storage } from '../lib/storage';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <BoardUiProvider>{children}</BoardUiProvider>
);

beforeEach(() => storage.clear('cursors'));

describe('useBoardUi — defaults', () => {
  it('starts with vote panel closed, no history selected, ranks visible, cursors on', () => {
    const { result } = renderHook(() => useBoardUi(), { wrapper });
    expect(result.current.votePanelOpen).toBe(false);
    expect(result.current.viewingHistoryId).toBeNull();
    expect(result.current.ranksVisible).toBe(true);
    expect(result.current.cursorsEnabled).toBe(true);
  });

  it('reads cursors visibility from storage on mount', () => {
    storage.write('cursors', 'off');
    const { result } = renderHook(() => useBoardUi(), { wrapper });
    expect(result.current.cursorsEnabled).toBe(false);
  });
});

describe('useBoardUi — actions', () => {
  it('toggleVotePanel flips the open flag', () => {
    const { result } = renderHook(() => useBoardUi(), { wrapper });
    act(() => result.current.toggleVotePanel());
    expect(result.current.votePanelOpen).toBe(true);
    act(() => result.current.toggleVotePanel());
    expect(result.current.votePanelOpen).toBe(false);
  });

  it('setVotePanelOpen accepts a value or an updater', () => {
    const { result } = renderHook(() => useBoardUi(), { wrapper });
    act(() => result.current.setVotePanelOpen(true));
    expect(result.current.votePanelOpen).toBe(true);
    act(() => result.current.setVotePanelOpen((p) => !p));
    expect(result.current.votePanelOpen).toBe(false);
  });

  it('setViewingHistoryId stores the id', () => {
    const { result } = renderHook(() => useBoardUi(), { wrapper });
    act(() => result.current.setViewingHistoryId('vote-7'));
    expect(result.current.viewingHistoryId).toBe('vote-7');
    act(() => result.current.setViewingHistoryId(null));
    expect(result.current.viewingHistoryId).toBeNull();
  });

  it('setRanksVisible accepts a value or an updater', () => {
    const { result } = renderHook(() => useBoardUi(), { wrapper });
    act(() => result.current.setRanksVisible(false));
    expect(result.current.ranksVisible).toBe(false);
    act(() => result.current.setRanksVisible((p) => !p));
    expect(result.current.ranksVisible).toBe(true);
  });

  it('setCursorsEnabled flips state and persists to storage', () => {
    const { result } = renderHook(() => useBoardUi(), { wrapper });
    act(() => result.current.setCursorsEnabled(false));
    expect(result.current.cursorsEnabled).toBe(false);
    expect(storage.read('cursors')).toBe('off');
    act(() => result.current.setCursorsEnabled(true));
    expect(storage.read('cursors')).toBe('on');
  });
});

describe('useBoardUi — outside the provider', () => {
  it('throws when no provider wraps the consumer', () => {
    // Suppress the React error console while the bad render happens.
    const orig = console.error;
    console.error = () => {};
    expect(() => renderHook(() => useBoardUi())).toThrow(/<BoardUiProvider>/);
    console.error = orig;
  });
});
