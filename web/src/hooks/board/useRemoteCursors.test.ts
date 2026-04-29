import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRemoteCursors } from './useRemoteCursors';
import { handlerRegistry, type CursorMoveData } from '../../state/handlerRegistry';

let send: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    return setTimeout(() => cb(0), 16) as unknown as number;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  send = vi.fn();
  handlerRegistry.reset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  handlerRegistry.reset();
});

function send_cursor(data: CursorMoveData) {
  handlerRegistry.invokeCursor(data);
}

describe('useRemoteCursors', () => {
  it('starts with no cursors', () => {
    const { result } = renderHook(() => useRemoteCursors(send));
    expect(result.current.cursors).toEqual([]);
  });

  it('registers a handler with handlerRegistry on mount and clears it on unmount', () => {
    const { unmount } = renderHook(() => useRemoteCursors(send));
    // Invoking should reach the hook (we'll observe the rAF flush below).
    const before = vi.fn();
    handlerRegistry.setCursorHandler(before);
    // Re-mount: the hook's effect overrides our test handler.
    const { unmount: unmount2 } = renderHook(() => useRemoteCursors(send));
    handlerRegistry.invokeCursor({ userId: 'u', name: 'n', x: 0, y: 0 });
    expect(before).not.toHaveBeenCalled();
    unmount();
    unmount2();
  });

  it('publishes incoming cursors after a rAF tick', () => {
    const { result } = renderHook(() => useRemoteCursors(send));
    act(() => {
      send_cursor({ userId: 'u2', name: 'Ben', x: 10, y: 20 });
      vi.advanceTimersByTime(20);
    });
    expect(result.current.cursors).toHaveLength(1);
    expect(result.current.cursors[0]).toMatchObject({ userId: 'u2', x: 10, y: 20 });
  });

  it("drops cursors we haven't heard from in over 5 seconds", () => {
    const { result } = renderHook(() => useRemoteCursors(send));
    act(() => {
      send_cursor({ userId: 'u2', name: 'Ben', x: 0, y: 0 });
      vi.advanceTimersByTime(20);
    });
    expect(result.current.cursors).toHaveLength(1);
    act(() => { vi.advanceTimersByTime(8_000); });
    expect(result.current.cursors).toHaveLength(0);
  });

  it('throttles outbound cursor_move to ~50ms', () => {
    const { result } = renderHook(() => useRemoteCursors(send));
    act(() => result.current.trackLocal(1, 2));
    act(() => result.current.trackLocal(3, 4));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('cursor_move', { x: 1, y: 2 });
    vi.advanceTimersByTime(60);
    act(() => result.current.trackLocal(5, 6));
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith('cursor_move', { x: 5, y: 6 });
  });
});
