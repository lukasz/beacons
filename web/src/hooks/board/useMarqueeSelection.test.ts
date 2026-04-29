import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMarqueeSelection } from './useMarqueeSelection';
import {
  fixtureBoardState,
  fixturePostIt,
  fixtureGroup,
} from '../../test/fixtures';

const boardRect = { left: 100, top: 50 };

describe('useMarqueeSelection — initial state', () => {
  it('starts inactive and with no marquee rect', () => {
    const { result } = renderHook(() => useMarqueeSelection());
    expect(result.current.isActive()).toBe(false);
    expect(result.current.marquee).toBeNull();
  });
});

describe('useMarqueeSelection — drag-threshold gating', () => {
  it('does not produce a marquee rect for a movement under the threshold', () => {
    const { result } = renderHook(() => useMarqueeSelection());
    act(() => result.current.start({ clientX: 150, clientY: 100 }, boardRect));
    expect(result.current.isActive()).toBe(true);
    act(() => { result.current.onPointerMove({ clientX: 152, clientY: 100 }); });
    expect(result.current.marquee).toBeNull();
  });

  it('starts producing rects once the threshold is crossed', () => {
    const { result } = renderHook(() => useMarqueeSelection());
    act(() => result.current.start({ clientX: 150, clientY: 100 }, boardRect));
    act(() => { result.current.onPointerMove({ clientX: 200, clientY: 150 }); });
    // anchor in board-rel coords: 150-100=50, 100-50=50.
    // delta: 200-150=50, 150-100=50.
    expect(result.current.marquee).toEqual({ sx: 50, sy: 50, ex: 100, ey: 100 });
  });
});

describe('useMarqueeSelection — commit', () => {
  it('returns [] for a click without drag', () => {
    const { result } = renderHook(() => useMarqueeSelection());
    act(() => result.current.start({ clientX: 150, clientY: 100 }, boardRect));
    let selected: ReturnType<typeof result.current.commit> | null = null;
    act(() => {
      selected = result.current.commit({ x: 0, y: 0, z: 1 }, fixtureBoardState());
    });
    expect(selected).toEqual([]);
    expect(result.current.isActive()).toBe(false);
    expect(result.current.marquee).toBeNull();
  });

  it('returns null when no marquee was in flight', () => {
    const { result } = renderHook(() => useMarqueeSelection());
    let selected: ReturnType<typeof result.current.commit> | null = null;
    act(() => {
      selected = result.current.commit({ x: 0, y: 0, z: 1 }, fixtureBoardState());
    });
    expect(selected).toBeNull();
  });

  it('hit-tests post-its / groups / images that overlap the marquee', () => {
    const state = fixtureBoardState({
      postIts: {
        // Each post-it is 160×100. p1 inside, p2 outside.
        p1: fixturePostIt({ id: 'p1', x: 60, y: 60 }),
        p2: fixturePostIt({ id: 'p2', x: 1000, y: 1000 }),
      },
      groups: {
        g1: fixtureGroup({ id: 'g1', x: 80, y: 80, w: 60, h: 30 }),
      },
      images: {
        i1: { id: 'i1', url: '', x: 1000, y: 1000, w: 50, h: 50 }, // outside
      },
    });
    const { result } = renderHook(() => useMarqueeSelection());
    // Drag a marquee from board (50, 50) to (200, 200) — in canvas
    // coords with transform identity that's the same rect.
    act(() => result.current.start({ clientX: 150, clientY: 100 }, boardRect));
    act(() => { result.current.onPointerMove({ clientX: 300, clientY: 250 }); });
    let selected: ReturnType<typeof result.current.commit> | null = null;
    act(() => {
      selected = result.current.commit({ x: 0, y: 0, z: 1 }, state);
    });
    expect(selected).toEqual(expect.arrayContaining([
      { type: 'postit', id: 'p1' },
      { type: 'group', id: 'g1' },
    ]));
    expect(selected).not.toContainEqual({ type: 'postit', id: 'p2' });
    expect(selected).not.toContainEqual({ type: 'image', id: 'i1' });
  });

  it('honours the canvas transform when hit-testing', () => {
    const state = fixtureBoardState({
      postIts: { p1: fixturePostIt({ id: 'p1', x: 0, y: 0 }) },
    });
    const { result } = renderHook(() => useMarqueeSelection());
    // Marquee in board-rel from (50, 50) to (60, 60). With transform
    // x=200 (panned right), the canvas-space rect is at (-150, -150)
    // to (-140, -140) → won't include p1 at (0, 0).
    act(() => result.current.start({ clientX: 150, clientY: 100 }, boardRect));
    act(() => { result.current.onPointerMove({ clientX: 160, clientY: 110 }); });
    let selected: ReturnType<typeof result.current.commit> | null = null;
    act(() => {
      selected = result.current.commit({ x: 200, y: 200, z: 1 }, state);
    });
    expect(selected).toEqual([]);
  });
});
