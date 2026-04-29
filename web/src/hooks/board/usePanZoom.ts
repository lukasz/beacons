/**
 * Pan/zoom for the board canvas. Owns:
 *   - the `transform` ref (x, y, z) that drives the CSS transform on
 *     the canvas element,
 *   - a non-passive wheel handler (zoom on regular scroll / pinch,
 *     two-finger horizontal pan),
 *   - the space-key-to-pan modifier that turns the cursor into "grab"
 *     and lets the caller treat any mouse-down as a pan start,
 *   - `screenToCanvas` and `getViewportCenter` helpers that other
 *     hooks (clipboard paste, marquee selection) share.
 *
 * Returns refs for the board and canvas elements that the caller
 * attaches to their DOM nodes. Keep the refs from the hook — don't
 * create new ones in the component.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { zoomRef } from '../../zoomRef';

export const MIN_ZOOM = 0.15;
export const MAX_ZOOM = 3;
export const ZOOM_SENSITIVITY = 0.002; // for scroll wheel
export const PINCH_SENSITIVITY = 0.008; // for trackpad pinch

export interface PanZoomApi {
  /** Attach this to the outer board div. */
  boardRef: React.RefObject<HTMLDivElement | null>;
  /** Attach this to the canvas div whose transform is driven. */
  canvasRef: React.RefObject<HTMLDivElement | null>;
  /** Mutable transform state. Reads are safe; mutate via {@link zoomTo}. */
  transform: React.RefObject<{ x: number; y: number; z: number }>;
  /** "Is the user mid-pan right now?" Set by the caller while panning. */
  isPanning: React.RefObject<boolean>;
  /** "Is space currently held?" Lets the caller treat clicks as pan starts. */
  spaceDown: React.RefObject<boolean>;
  /** Active pan state — caller manages the pointer-down/move/up cycle. */
  panRef: React.RefObject<{ pointerId: number; startX: number; startY: number; origX: number; origY: number } | null>;
  /** Current zoom percentage (100 = identity). */
  zoomDisplay: number;

  /** Apply `transform.current` to the canvas element. */
  applyTransform: () => void;
  /**
   * Animate (well, snap) to the target zoom while keeping the given
   * screen-space pivot fixed.
   */
  zoomTo: (newZoom: number, pivotX: number, pivotY: number) => void;
  /** Convert a screen-space point to canvas coordinates. */
  screenToCanvas: (screenX: number, screenY: number) => { x: number; y: number };
  /** Centre of the visible board in screen coordinates. */
  getViewportCenter: () => { x: number; y: number };
  /** Reset to identity transform (and zoom display to 100%). */
  resetTransform: () => void;
}

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export function usePanZoom(): PanZoomApi {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const transform = useRef({ x: 0, y: 0, z: 1 });
  const [zoomDisplay, setZoomDisplay] = useState(100);
  const panRef = useRef<PanZoomApi['panRef']['current']>(null);
  const isPanning = useRef(false);
  const spaceDown = useRef(false);

  const applyTransform = useCallback(() => {
    const el = canvasRef.current;
    if (!el) return;
    const { x, y, z } = transform.current;
    el.style.transform = `translate(${x}px, ${y}px) scale(${z})`;
  }, []);

  const zoomTo = useCallback((newZoom: number, pivotX: number, pivotY: number) => {
    const t = transform.current;
    const oldZoom = t.z;
    const clamped = clampZoom(newZoom);
    if (clamped === oldZoom) return;
    const scale = clamped / oldZoom;
    t.x = pivotX - (pivotX - t.x) * scale;
    t.y = pivotY - (pivotY - t.y) * scale;
    t.z = clamped;
    zoomRef.current = clamped;
    applyTransform();
    setZoomDisplay(Math.round(clamped * 100));
  }, [applyTransform]);

  const screenToCanvas = useCallback((screenX: number, screenY: number) => {
    const board = boardRef.current;
    if (!board) return { x: 0, y: 0 };
    const rect = board.getBoundingClientRect();
    const t = transform.current;
    return {
      x: (screenX - rect.left - t.x) / t.z,
      y: (screenY - rect.top - t.y) / t.z,
    };
  }, []);

  const getViewportCenter = useCallback(() => {
    const board = boardRef.current;
    if (!board) return { x: 0, y: 0 };
    const rect = board.getBoundingClientRect();
    return { x: rect.width / 2, y: rect.height / 2 };
  }, []);

  const resetTransform = useCallback(() => {
    transform.current = { x: 0, y: 0, z: 1 };
    zoomRef.current = 1;
    applyTransform();
    setZoomDisplay(100);
  }, [applyTransform]);

  // Space key for panning. The pointer handler in Board uses
  // `spaceDown.current` to recognise space-drag.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' &&
        !e.repeat &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        spaceDown.current = true;
        if (boardRef.current) boardRef.current.style.cursor = 'grab';
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceDown.current = false;
        if (boardRef.current && !isPanning.current) boardRef.current.style.cursor = '';
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Wheel handler — non-passive so we can preventDefault and absorb
  // ctrl+wheel (pinch) without the page zooming.
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const t = transform.current;
      const rect = board.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      if (e.ctrlKey) {
        // Pinch-to-zoom (trackpad).
        zoomTo(t.z * (1 - e.deltaY * PINCH_SENSITIVITY), mouseX, mouseY);
      } else if (e.deltaX !== 0 && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        // Two-finger horizontal swipe — pan.
        t.x -= e.deltaX;
        applyTransform();
      } else {
        // Regular wheel — zoom centred on mouse.
        zoomTo(t.z * (1 - e.deltaY * ZOOM_SENSITIVITY), mouseX, mouseY);
      }
    };

    board.addEventListener('wheel', handleWheel, { passive: false });
    return () => board.removeEventListener('wheel', handleWheel);
  }, [zoomTo, applyTransform]);

  return {
    boardRef,
    canvasRef,
    transform,
    isPanning,
    spaceDown,
    panRef,
    zoomDisplay,
    applyTransform,
    zoomTo,
    screenToCanvas,
    getViewportCenter,
    resetTransform,
  };
}
