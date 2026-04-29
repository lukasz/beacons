import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useClipboard, type SelectedItem } from './useClipboard';
import {
  fixtureBoardState,
  fixturePostIt,
  fixtureGroup,
  fixtureSection,
} from '../../test/fixtures';

let send: ReturnType<typeof vi.fn>;
beforeEach(() => {
  send = vi.fn();
});

const stateWithItems = () => fixtureBoardState({
  postIts: {
    p1: fixturePostIt({ id: 'p1', text: 'hello', x: 100, y: 200, colorIdx: 2 }),
    p2: fixturePostIt({ id: 'p2', text: 'world', x: 300, y: 250 }),
  },
  groups: { g1: fixtureGroup({ id: 'g1', label: 'cluster', x: 80, y: 180, w: 60, h: 30 }) },
  sections: { s1: fixtureSection({ id: 's1', title: 'Wins', x: 50, y: 100, w: 400, h: 300 }) },
});

describe('useClipboard', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => useClipboard(stateWithItems(), send, 'u1'));
    expect(result.current.hasItems()).toBe(false);
  });

  it('copyItems with empty selection is a no-op', () => {
    const { result } = renderHook(() => useClipboard(stateWithItems(), send, 'u1'));
    act(() => result.current.copyItems([]));
    expect(result.current.hasItems()).toBe(false);
  });

  it('paste with nothing in the clipboard sends nothing', () => {
    const { result } = renderHook(() => useClipboard(stateWithItems(), send, 'u1'));
    act(() => result.current.pasteItems(0, 0));
    expect(send).not.toHaveBeenCalled();
  });

  it('round-trips a post-it preserving its content', () => {
    const { result } = renderHook(() => useClipboard(stateWithItems(), send, 'u1'));
    const items: SelectedItem[] = [{ type: 'postit', id: 'p1' }];
    act(() => result.current.copyItems(items));
    expect(result.current.hasItems()).toBe(true);
    act(() => result.current.pasteItems(500, 600));
    expect(send).toHaveBeenCalledWith('add_postit', expect.objectContaining({
      authorId: 'u1',
      text: 'hello',
      x: 500,
      y: 600,
      colorIdx: 2,
    }));
  });

  it('preserves relative offsets when pasting multiple items', () => {
    const { result } = renderHook(() => useClipboard(stateWithItems(), send, 'u1'));
    const items: SelectedItem[] = [
      { type: 'postit', id: 'p1' }, // top-left of selection (100, 200)
      { type: 'postit', id: 'p2' }, // (300, 250) — 200 right, 50 down
    ];
    act(() => result.current.copyItems(items));
    act(() => result.current.pasteItems(0, 0));
    expect(send).toHaveBeenNthCalledWith(1, 'add_postit', expect.objectContaining({ x: 0, y: 0 }));
    expect(send).toHaveBeenNthCalledWith(2, 'add_postit', expect.objectContaining({ x: 200, y: 50 }));
  });

  it('skips items that are no longer in state', () => {
    const { result } = renderHook(() => useClipboard(stateWithItems(), send, 'u1'));
    const items: SelectedItem[] = [{ type: 'postit', id: 'missing' }];
    act(() => result.current.copyItems(items));
    expect(result.current.hasItems()).toBe(false);
  });

  it('handles a mixed selection (postit + group + section)', () => {
    const { result } = renderHook(() => useClipboard(stateWithItems(), send, 'u1'));
    const items: SelectedItem[] = [
      { type: 'postit', id: 'p1' },
      { type: 'group', id: 'g1' },
      { type: 'section', id: 's1' },
    ];
    act(() => result.current.copyItems(items));
    act(() => result.current.pasteItems(1000, 1000));
    const calls = send.mock.calls.map((c) => c[0]);
    expect(calls).toEqual(expect.arrayContaining(['add_postit', 'add_group', 'add_section']));
  });
});
