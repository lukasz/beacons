import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePanZoom, MIN_ZOOM, MAX_ZOOM } from './usePanZoom';

let board: HTMLDivElement;
let canvas: HTMLDivElement;

function attach(api: ReturnType<typeof usePanZoom>) {
  // Manually wire the refs the way Board would.
  (api.boardRef as { current: HTMLDivElement | null }).current = board;
  (api.canvasRef as { current: HTMLDivElement | null }).current = canvas;
  // Stub getBoundingClientRect for screenToCanvas / wheel handlers.
  board.getBoundingClientRect = () =>
    ({ left: 100, top: 50, width: 800, height: 600, right: 900, bottom: 650, x: 100, y: 50, toJSON() {} }) as DOMRect;
}

beforeEach(() => {
  document.body.innerHTML = '';
  board = document.createElement('div');
  canvas = document.createElement('div');
  document.body.appendChild(board);
  document.body.appendChild(canvas);
});

describe('usePanZoom — initial state', () => {
  it('starts at identity transform and 100% zoom', () => {
    const { result } = renderHook(() => usePanZoom());
    expect(result.current.transform.current).toEqual({ x: 0, y: 0, z: 1 });
    expect(result.current.zoomDisplay).toBe(100);
  });
});

describe('zoomTo', () => {
  it('clamps below MIN_ZOOM', () => {
    const { result } = renderHook(() => usePanZoom());
    attach(result.current);
    act(() => result.current.zoomTo(0.01, 0, 0));
    expect(result.current.transform.current.z).toBe(MIN_ZOOM);
  });

  it('clamps above MAX_ZOOM', () => {
    const { result } = renderHook(() => usePanZoom());
    attach(result.current);
    act(() => result.current.zoomTo(99, 0, 0));
    expect(result.current.transform.current.z).toBe(MAX_ZOOM);
  });

  it('keeps the pivot point fixed in screen space', () => {
    const { result } = renderHook(() => usePanZoom());
    attach(result.current);
    // From identity, zoom in 2× pivoting on (200, 100). The pivot should
    // remain the same screen point: pivot - (pivot - t.x) * scale.
    act(() => result.current.zoomTo(2, 200, 100));
    const t = result.current.transform.current;
    expect(t.z).toBe(2);
    expect(t.x).toBe(200 - 200 * 2); // -200
    expect(t.y).toBe(100 - 100 * 2); // -100
  });

  it('updates zoomDisplay (rounded to nearest %)', () => {
    const { result } = renderHook(() => usePanZoom());
    attach(result.current);
    act(() => result.current.zoomTo(1.234, 0, 0));
    expect(result.current.zoomDisplay).toBe(123);
  });

  it('applies the transform to the canvas element', () => {
    const { result } = renderHook(() => usePanZoom());
    attach(result.current);
    act(() => result.current.zoomTo(1.5, 0, 0));
    expect(canvas.style.transform).toBe('translate(0px, 0px) scale(1.5)');
  });
});

describe('screenToCanvas', () => {
  it('subtracts the board offset and divides by zoom', () => {
    const { result } = renderHook(() => usePanZoom());
    attach(result.current);
    // board.left=100, top=50; transform identity.
    expect(result.current.screenToCanvas(300, 200)).toEqual({ x: 200, y: 150 });
  });

  it('accounts for the active transform', () => {
    const { result } = renderHook(() => usePanZoom());
    attach(result.current);
    act(() => result.current.zoomTo(2, 0, 0));
    // After 2× zoom pivot at (0,0): t.x = -100*2 = ? No, pivot is 0, so t = 0.
    // 200 board-space = (200 - 0) / 2 = 100 canvas-space.
    expect(result.current.screenToCanvas(300, 250)).toEqual({ x: 100, y: 100 });
  });
});

describe('space-key panning modifier', () => {
  it('flips spaceDown true on space-down and false on space-up', () => {
    const { result } = renderHook(() => usePanZoom());
    attach(result.current);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    });
    expect(result.current.spaceDown.current).toBe(true);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    });
    expect(result.current.spaceDown.current).toBe(false);
  });

  it('ignores space when an input is focused', () => {
    const { result } = renderHook(() => usePanZoom());
    attach(result.current);
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
    });
    expect(result.current.spaceDown.current).toBe(false);
  });
});
