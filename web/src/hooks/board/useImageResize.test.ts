import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useImageResize } from './useImageResize';
import { zoomRef } from '../../zoomRef';

let send: ReturnType<typeof vi.fn>;

beforeEach(() => {
  send = vi.fn();
  zoomRef.current = 1;
});

const img = { id: 'img1', x: 100, y: 100, w: 200, h: 100 };

describe('useImageResize — initial state', () => {
  it('is inactive by default', () => {
    const { result } = renderHook(() => useImageResize(send));
    expect(result.current.isActive()).toBe(false);
    expect(result.current.onPointerMove({ clientX: 0, clientY: 0 })).toBe(false);
    expect(result.current.onPointerUp()).toBe(false);
  });
});

describe('useImageResize — SE corner', () => {
  it('grows width and preserves aspect ratio', () => {
    const { result } = renderHook(() => useImageResize(send));
    act(() => result.current.start('se', img, { clientX: 0, clientY: 0 }));
    expect(result.current.isActive()).toBe(true);
    act(() => { result.current.onPointerMove({ clientX: 100, clientY: 0 }); });
    expect(send).toHaveBeenCalledWith('move_image', {
      id: 'img1',
      // origW 200 + dx 100 = 300; aspect 2:1 → 150 high.
      x: 100,
      y: 100,
      w: 300,
      h: 150,
    });
  });

  it('clamps to minimum size', () => {
    const { result } = renderHook(() => useImageResize(send));
    act(() => result.current.start('se', img, { clientX: 0, clientY: 0 }));
    act(() => { result.current.onPointerMove({ clientX: -1000, clientY: 0 }); });
    const last = send.mock.calls[send.mock.calls.length - 1]![1] as { w: number; h: number };
    expect(last.w).toBe(40);
    expect(last.h).toBe(20);
  });
});

describe('useImageResize — opposite corners anchor correctly', () => {
  it('NW: top-left moves; bottom-right (origX+origW, origY+origH) stays fixed', () => {
    const { result } = renderHook(() => useImageResize(send));
    act(() => result.current.start('nw', img, { clientX: 0, clientY: 0 }));
    // Drag inwards by 50 → newW = 200 - 50 = 150; aspect 2:1 → newH = 75.
    act(() => { result.current.onPointerMove({ clientX: 50, clientY: 0 }); });
    const last = send.mock.calls[send.mock.calls.length - 1]![1] as { x: number; y: number; w: number; h: number };
    expect(last.w).toBe(150);
    expect(last.h).toBe(75);
    // origX + origW = 300 should equal new x + new w.
    expect(last.x + last.w).toBe(img.x + img.w);
    expect(last.y + last.h).toBe(img.y + img.h);
  });

  it('NE: top-right anchored', () => {
    const { result } = renderHook(() => useImageResize(send));
    act(() => result.current.start('ne', img, { clientX: 0, clientY: 0 }));
    act(() => { result.current.onPointerMove({ clientX: 100, clientY: 0 }); });
    const last = send.mock.calls[send.mock.calls.length - 1]![1] as { x: number; y: number; w: number; h: number };
    // x stays origX (100); height grows downward from bottom anchor.
    expect(last.x).toBe(100);
    expect(last.y + last.h).toBe(img.y + img.h);
  });

  it('SW: bottom-left anchored', () => {
    const { result } = renderHook(() => useImageResize(send));
    act(() => result.current.start('sw', img, { clientX: 0, clientY: 0 }));
    act(() => { result.current.onPointerMove({ clientX: -50, clientY: 0 }); });
    const last = send.mock.calls[send.mock.calls.length - 1]![1] as { x: number; y: number; w: number; h: number };
    // y stays origY; right edge stays at origX + origW.
    expect(last.y).toBe(100);
    expect(last.x + last.w).toBe(img.x + img.w);
  });
});

describe('useImageResize — zoom-aware', () => {
  it('divides screen-space delta by zoom', () => {
    zoomRef.current = 2;
    const { result } = renderHook(() => useImageResize(send));
    act(() => result.current.start('se', img, { clientX: 0, clientY: 0 }));
    act(() => { result.current.onPointerMove({ clientX: 200, clientY: 0 }); });
    // 200 screen px / zoom 2 = 100 canvas px → newW 300, newH 150.
    const last = send.mock.calls[send.mock.calls.length - 1]![1] as { w: number; h: number };
    expect(last.w).toBe(300);
    expect(last.h).toBe(150);
  });
});

describe('useImageResize — onPointerUp', () => {
  it('clears state and reports it had been active', () => {
    const { result } = renderHook(() => useImageResize(send));
    act(() => result.current.start('se', img, { clientX: 0, clientY: 0 }));
    expect(result.current.isActive()).toBe(true);
    expect(result.current.onPointerUp()).toBe(true);
    expect(result.current.isActive()).toBe(false);
  });
});
