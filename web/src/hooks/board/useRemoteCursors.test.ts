import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRemoteCursors } from './useRemoteCursors';

let send: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  // jsdom doesn't ship a fake rAF; route to setTimeout so we can step it.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    return setTimeout(() => cb(0), 16) as unknown as number;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  send = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function getInbound() {
  return (window as unknown as { __handleCursorMove?: (data: unknown) => void }).__handleCursorMove;
}

describe('useRemoteCursors', () => {
  it('starts with no cursors', () => {
    const { result } = renderHook(() => useRemoteCursors(send));
    expect(result.current.cursors).toEqual([]);
  });

  it('registers and clears the global cursor handler', () => {
    const { unmount } = renderHook(() => useRemoteCursors(send));
    expect(getInbound()).toBeDefined();
    unmount();
    expect(getInbound()).toBeUndefined();
  });

  it('publishes incoming cursors after a rAF tick', () => {
    const { result } = renderHook(() => useRemoteCursors(send));
    act(() => {
      getInbound()!({ userId: 'u2', name: 'Ben', x: 10, y: 20 });
      vi.advanceTimersByTime(20);
    });
    expect(result.current.cursors).toHaveLength(1);
    expect(result.current.cursors[0]).toMatchObject({ userId: 'u2', x: 10, y: 20 });
  });

  it('drops cursors we haven\'t heard from in over 5 seconds', () => {
    const { result } = renderHook(() => useRemoteCursors(send));
    act(() => {
      getInbound()!({ userId: 'u2', name: 'Ben', x: 0, y: 0 });
      vi.advanceTimersByTime(20);
    });
    expect(result.current.cursors).toHaveLength(1);
    // Advance past STALE_MS (5s) and let the SWEEP_MS (3s) interval run.
    act(() => { vi.advanceTimersByTime(8_000); });
    expect(result.current.cursors).toHaveLength(0);
  });

  it('throttles outbound cursor_move to ~50ms', () => {
    const { result } = renderHook(() => useRemoteCursors(send));
    // First call goes out (lastSendAt = 0; Date.now() - 0 > 50).
    act(() => result.current.trackLocal(1, 2));
    // A second call within the window is dropped.
    act(() => result.current.trackLocal(3, 4));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('cursor_move', { x: 1, y: 2 });
    // After the window elapses, the next call goes through.
    vi.advanceTimersByTime(60);
    act(() => result.current.trackLocal(5, 6));
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith('cursor_move', { x: 5, y: 6 });
  });
});
