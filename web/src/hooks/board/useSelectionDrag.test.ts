import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSelectionDrag, DRAG_THRESHOLD } from './useSelectionDrag';
import { zoomRef } from '../../zoomRef';

let send: ReturnType<typeof vi.fn>;

beforeEach(() => {
  send = vi.fn();
  zoomRef.current = 1;
});

const snaps = [
  { type: 'postit' as const, id: 'p1', x: 100, y: 100 },
  { type: 'group' as const,  id: 'g1', x: 200, y: 200 },
  { type: 'section' as const, id: 's1', x: 0, y: 0 },
  { type: 'image' as const,  id: 'i1', x: 50, y: 50 },
];

describe('useSelectionDrag — initial state', () => {
  it('is inactive', () => {
    const { result } = renderHook(() => useSelectionDrag(send));
    expect(result.current.isActive()).toBe(false);
    expect(result.current.hasMoved()).toBe(false);
    expect(result.current.onPointerMove({ clientX: 0, clientY: 0 })).toBe(false);
  });
});

describe('useSelectionDrag — drag-threshold gating', () => {
  it('stays silent until the pointer travels past the threshold', () => {
    const { result } = renderHook(() => useSelectionDrag(send));
    act(() => result.current.start(snaps, { clientX: 0, clientY: 0 }));
    expect(result.current.isActive()).toBe(true);
    // Tiny wobble (≤ threshold) — handled (we own the pointer) but no emit.
    act(() => { result.current.onPointerMove({ clientX: DRAG_THRESHOLD, clientY: 0 }); });
    expect(send).not.toHaveBeenCalled();
    expect(result.current.hasMoved()).toBe(false);
    // Move past the threshold — emit fires for every snapshot.
    act(() => { result.current.onPointerMove({ clientX: DRAG_THRESHOLD + 5, clientY: 0 }); });
    expect(send).toHaveBeenCalledTimes(snaps.length);
    expect(result.current.hasMoved()).toBe(true);
  });
});

describe('useSelectionDrag — broadcast shape', () => {
  it('uses the correct message per type and applies the delta to snapshot x/y', () => {
    const { result } = renderHook(() => useSelectionDrag(send));
    act(() => result.current.start(snaps, { clientX: 0, clientY: 0 }));
    act(() => { result.current.onPointerMove({ clientX: 50, clientY: 30 }); });
    expect(send).toHaveBeenCalledWith('move_postit', { id: 'p1', x: 150, y: 130 });
    expect(send).toHaveBeenCalledWith('update_group', { id: 'g1', x: 250, y: 230 });
    expect(send).toHaveBeenCalledWith('update_section', { id: 's1', x: 50, y: 30 });
    expect(send).toHaveBeenCalledWith('move_image', { id: 'i1', x: 100, y: 80 });
  });

  it('divides the delta by zoom', () => {
    zoomRef.current = 2;
    const { result } = renderHook(() => useSelectionDrag(send));
    act(() => result.current.start(snaps, { clientX: 0, clientY: 0 }));
    act(() => { result.current.onPointerMove({ clientX: 100, clientY: 0 }); });
    // 100 px screen / zoom 2 = 50 canvas → x: 100 + 50 = 150.
    expect(send).toHaveBeenCalledWith('move_postit', { id: 'p1', x: 150, y: 100 });
  });
});

describe('useSelectionDrag — onPointerUp', () => {
  it('clears state and reports it had been active', () => {
    const { result } = renderHook(() => useSelectionDrag(send));
    act(() => result.current.start(snaps, { clientX: 0, clientY: 0 }));
    expect(result.current.onPointerUp()).toBe(true);
    expect(result.current.isActive()).toBe(false);
  });

  it('returns false when no drag is in progress', () => {
    const { result } = renderHook(() => useSelectionDrag(send));
    expect(result.current.onPointerUp()).toBe(false);
  });
});
